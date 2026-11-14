import { and, asc, desc, eq, like, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  exercises,
  planExercises,
  workoutExercises,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from '@/database/schema';
import { getDb } from '@/database/client';
import { AppError, ValidationError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';

export interface ExerciseFilter {
  search?: string;
  muscle?: MuscleGroup | null;
  equipment?: Equipment | null;
  favoritesOnly?: boolean;
}

export function listExercises(filter: ExerciseFilter = {}): Exercise[] {
  const conds = [eq(exercises.isArchived, false)];
  const q = filter.search?.trim();
  if (q) conds.push(like(exercises.name, `%${q.replace(/[%_]/g, '')}%`));
  if (filter.muscle) conds.push(eq(exercises.primaryMuscle, filter.muscle));
  if (filter.equipment) conds.push(eq(exercises.equipment, filter.equipment));
  if (filter.favoritesOnly) conds.push(eq(exercises.isFavorite, true));
  return getDb()
    .select()
    .from(exercises)
    .where(and(...conds))
    .orderBy(desc(exercises.isFavorite), asc(exercises.name))
    .all();
}

export function getExercise(id: string): Exercise | null {
  return getDb().select().from(exercises).where(eq(exercises.id, id)).get() ?? null;
}

export function parseSecondary(ex: Pick<Exercise, 'secondaryMuscles'>): MuscleGroup[] {
  try {
    const v = JSON.parse(ex.secondaryMuscles);
    return Array.isArray(v) ? v.filter((m): m is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(m)) : [];
  } catch {
    return [];
  }
}

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, 'Exercise name cannot be empty.').max(80, 'Exercise name is too long.'),
  primaryMuscle: z.enum(MUSCLE_GROUPS, { message: 'Choose a primary muscle.' }),
  secondaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).default([]),
  equipment: z.enum(EQUIPMENT, { message: 'Choose equipment.' }),
  exerciseType: z.enum(EXERCISE_TYPES).default('strength'),
  instructions: z.string().max(2000).default(''),
  defaultRestSeconds: z.number().int().min(0).max(1800).nullable().default(null),
});
export type ExerciseInput = z.input<typeof exerciseInputSchema>;

function assertUniqueName(name: string, exceptId?: string) {
  const dup = getDb()
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        sql`lower(${exercises.name}) = lower(${name})`,
        eq(exercises.isArchived, false),
        exceptId ? ne(exercises.id, exceptId) : undefined,
      ),
    )
    .get();
  if (dup) throw new ValidationError(`An exercise named "${name}" already exists.`);
}

export function createCustomExercise(input: ExerciseInput): string {
  const v = validate(exerciseInputSchema, input);
  assertUniqueName(v.name);
  const id = newId();
  const nowMs = Date.now();
  getDb()
    .insert(exercises)
    .values({
      id,
      name: v.name,
      primaryMuscle: v.primaryMuscle,
      secondaryMuscles: JSON.stringify(v.secondaryMuscles.filter((m) => m !== v.primaryMuscle)),
      equipment: v.equipment,
      exerciseType: v.exerciseType,
      instructions: v.instructions,
      defaultRestSeconds: v.defaultRestSeconds,
      isCustom: true,
      createdAt: nowMs,
      updatedAt: nowMs,
    })
    .run();
  notifyDataChanged();
  return id;
}

/** Only custom exercises can be edited. Historical workouts keep their name snapshot. */
export function updateCustomExercise(id: string, input: ExerciseInput): void {
  const existing = getExercise(id);
  if (!existing) throw new AppError('Exercise not found.', 'not_found');
  if (!existing.isCustom) throw new AppError('Built-in exercises cannot be edited. Create a custom exercise instead.');
  const v = validate(exerciseInputSchema, input);
  assertUniqueName(v.name, id);
  getDb()
    .update(exercises)
    .set({
      name: v.name,
      primaryMuscle: v.primaryMuscle,
      secondaryMuscles: JSON.stringify(v.secondaryMuscles.filter((m) => m !== v.primaryMuscle)),
      equipment: v.equipment,
      exerciseType: v.exerciseType,
      instructions: v.instructions,
      defaultRestSeconds: v.defaultRestSeconds,
      updatedAt: Date.now(),
    })
    .where(eq(exercises.id, id))
    .run();
  notifyDataChanged();
}

export function toggleFavorite(id: string): void {
  getDb()
    .update(exercises)
    .set({ isFavorite: sql`not ${exercises.isFavorite}`, updatedAt: Date.now() })
    .where(eq(exercises.id, id))
    .run();
  notifyDataChanged();
}

export function isExerciseInUse(id: string): boolean {
  const db = getDb();
  const inWorkouts = db.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.exerciseId, id)).limit(1).get();
  const inPlans = db.select({ id: planExercises.id }).from(planExercises).where(eq(planExercises.exerciseId, id)).limit(1).get();
  return !!inWorkouts || !!inPlans;
}

/**
 * Delete a custom exercise. If it is referenced by workout history or plans it is
 * archived instead (hidden from the library) so historical records stay intact.
 */
export function deleteCustomExercise(id: string): 'deleted' | 'archived' {
  const ex = getExercise(id);
  if (!ex) return 'deleted';
  if (!ex.isCustom) throw new AppError('Built-in exercises cannot be deleted.');
  const db = getDb();
  let outcome: 'deleted' | 'archived';
  if (isExerciseInUse(id)) {
    db.update(exercises).set({ isArchived: true, isFavorite: false, updatedAt: Date.now() }).where(eq(exercises.id, id)).run();
    outcome = 'archived';
  } else {
    db.delete(exercises).where(eq(exercises.id, id)).run();
    outcome = 'deleted';
  }
  notifyDataChanged();
  return outcome;
}
