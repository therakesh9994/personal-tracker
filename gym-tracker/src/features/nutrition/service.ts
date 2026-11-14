import { and, asc, between, desc, eq, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { MEAL_TYPES, foods, nutritionEntries, waterLogs, type Food, type MealType, type NutritionEntry, type WaterLog } from '@/database/schema';
import { getDb } from '@/database/client';
import { AppError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';
import { dayRange } from '@/utils/time';
import { dailyTotals, mealTotals, type MacroTotals } from './calculations';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

const macro = (label: string) => z.number({ message: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(10000, `${label} looks too large.`);

export const foodSchema = z.object({
  name: z.string().trim().min(1, 'Food name cannot be empty.').max(80, 'Food name is too long.'),
  servingSize: z.number({ message: 'Serving size must be a number.' }).positive('Serving size must be greater than 0.').max(10000),
  servingUnit: z.string().trim().min(1, 'Serving unit cannot be empty.').max(20),
  calories: macro('Calories'),
  proteinG: macro('Protein'),
  carbsG: macro('Carbohydrates'),
  fatG: macro('Fat'),
});
export type FoodInput = z.input<typeof foodSchema>;

export function listFoods(search = ''): Food[] {
  const q = search.trim().replace(/[%_]/g, '');
  return getDb()
    .select()
    .from(foods)
    .where(and(eq(foods.isArchived, false), q ? like(foods.name, `%${q}%`) : undefined))
    .orderBy(sql`${foods.lastUsedAt} is null`, desc(foods.lastUsedAt), asc(foods.name))
    .all();
}

export function getFood(id: string): Food | null {
  return getDb().select().from(foods).where(eq(foods.id, id)).get() ?? null;
}

export function createFood(input: FoodInput): string {
  const v = validate(foodSchema, input);
  const id = newId();
  const nowMs = Date.now();
  getDb().insert(foods).values({ id, ...v, createdAt: nowMs, updatedAt: nowMs }).run();
  notifyDataChanged();
  return id;
}

/** Editing a food does not change past entries (they hold their own snapshot). */
export function updateFood(id: string, input: FoodInput): void {
  const v = validate(foodSchema, input);
  getDb().update(foods).set({ ...v, updatedAt: Date.now() }).where(eq(foods.id, id)).run();
  notifyDataChanged();
}

/** Remove a food from the list. Logged entries keep their snapshot. */
export function deleteFood(id: string): void {
  getDb().update(foods).set({ isArchived: true, updatedAt: Date.now() }).where(eq(foods.id, id)).run();
  notifyDataChanged();
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

const quantitySchema = z.number({ message: 'Quantity must be a number.' }).positive('Quantity must be greater than 0.').max(1000, 'Quantity looks too large.');

export function logFood(input: { foodId: string; meal: MealType; quantity: number; loggedAt?: number }): string {
  const quantity = validate(quantitySchema, input.quantity);
  const meal = validate(z.enum(MEAL_TYPES), input.meal);
  const db = getDb();
  const nowMs = Date.now();
  const id = newId();
  db.transaction((tx) => {
    const food = tx.select().from(foods).where(eq(foods.id, input.foodId)).get();
    if (!food) throw new AppError('Food not found.', 'not_found');
    tx.insert(nutritionEntries)
      .values({
        id,
        foodId: food.id,
        loggedAt: input.loggedAt ?? nowMs,
        meal,
        quantity,
        foodName: food.name,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        caloriesPerServing: food.calories,
        proteinPerServing: food.proteinG,
        carbsPerServing: food.carbsG,
        fatPerServing: food.fatG,
        createdAt: nowMs,
        updatedAt: nowMs,
      })
      .run();
    tx.update(foods).set({ lastUsedAt: nowMs }).where(eq(foods.id, food.id)).run();
  });
  notifyDataChanged();
  return id;
}

export function updateEntry(id: string, patch: { quantity?: number; meal?: MealType; loggedAt?: number }): void {
  const set: Partial<NutritionEntry> = { updatedAt: Date.now() };
  if (patch.quantity !== undefined) set.quantity = validate(quantitySchema, patch.quantity);
  if (patch.meal !== undefined) set.meal = validate(z.enum(MEAL_TYPES), patch.meal);
  if (patch.loggedAt !== undefined) set.loggedAt = patch.loggedAt;
  getDb().update(nutritionEntries).set(set).where(eq(nutritionEntries.id, id)).run();
  notifyDataChanged();
}

export function deleteEntry(id: string): void {
  getDb().delete(nutritionEntries).where(eq(nutritionEntries.id, id)).run();
  notifyDataChanged();
}

export function getEntry(id: string): NutritionEntry | null {
  return getDb().select().from(nutritionEntries).where(eq(nutritionEntries.id, id)).get() ?? null;
}

export interface DayNutrition {
  entries: NutritionEntry[];
  totals: MacroTotals;
  byMeal: Record<MealType, MacroTotals>;
}

export function getDayNutrition(dayMs: number): DayNutrition {
  const { start, end } = dayRange(dayMs);
  const entries = getDb()
    .select()
    .from(nutritionEntries)
    .where(between(nutritionEntries.loggedAt, start, end))
    .orderBy(asc(nutritionEntries.loggedAt))
    .all();
  return { entries, totals: dailyTotals(entries), byMeal: mealTotals(entries) };
}

// ---------------------------------------------------------------------------
// Water (stored in milliliters)
// ---------------------------------------------------------------------------

const waterSchema = z.number({ message: 'Amount must be a number.' }).int('Use whole milliliters.').positive('Amount must be greater than 0.').max(5000, 'Amount looks too large.');

export function addWater(amountMl: number, loggedAt = Date.now()): string {
  const v = validate(waterSchema, amountMl);
  const id = newId();
  getDb().insert(waterLogs).values({ id, amountMl: v, loggedAt, createdAt: Date.now(), updatedAt: Date.now() }).run();
  notifyDataChanged();
  return id;
}

export function deleteWater(id: string): void {
  getDb().delete(waterLogs).where(eq(waterLogs.id, id)).run();
  notifyDataChanged();
}

export function getDayWater(dayMs: number): { logs: WaterLog[]; totalMl: number } {
  const { start, end } = dayRange(dayMs);
  const logs = getDb().select().from(waterLogs).where(between(waterLogs.loggedAt, start, end)).orderBy(desc(waterLogs.loggedAt)).all();
  return { logs, totalMl: logs.reduce((s, l) => s + l.amountMl, 0) };
}

/** Daily water totals (most recent first), aggregated in SQL. */
export function getWaterHistory(limitDays = 60): { day: string; totalMl: number }[] {
  return getDb()
    .select({
      day: sql<string>`date(${waterLogs.loggedAt} / 1000, 'unixepoch', 'localtime')`,
      totalMl: sql<number>`sum(${waterLogs.amountMl})`,
    })
    .from(waterLogs)
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`)
    .limit(limitDays)
    .all();
}
