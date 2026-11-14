import type { MealType } from '@/database/schema';

export interface EntryLike {
  meal: MealType;
  quantity: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const emptyTotals = (): MacroTotals => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

export function entryTotals(e: EntryLike): MacroTotals {
  return {
    calories: e.caloriesPerServing * e.quantity,
    protein: e.proteinPerServing * e.quantity,
    carbs: e.carbsPerServing * e.quantity,
    fat: e.fatPerServing * e.quantity,
  };
}

export function addTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function dailyTotals(entries: EntryLike[]): MacroTotals {
  return entries.map(entryTotals).reduce(addTotals, emptyTotals());
}

export function mealTotals(entries: EntryLike[]): Record<MealType, MacroTotals> {
  const out: Record<MealType, MacroTotals> = {
    breakfast: emptyTotals(),
    lunch: emptyTotals(),
    dinner: emptyTotals(),
    snack: emptyTotals(),
  };
  for (const e of entries) out[e.meal] = addTotals(out[e.meal], entryTotals(e));
  return out;
}

/** Progress toward a goal in [0, 1+]; null when no goal is set. */
export function goalProgress(value: number, goal: number | null | undefined): number | null {
  if (goal == null || goal <= 0) return null;
  return value / goal;
}
