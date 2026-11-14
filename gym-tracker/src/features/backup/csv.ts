/** CSV export builders (RFC 4180 quoting). Values are exported in kg / cm / ml. */
import { asc, desc, eq } from 'drizzle-orm';
import * as schema from '@/database/schema';
import type { AppDb } from '@/database/types';
import { estimateOneRepMax } from '@/features/workouts/calculations';

export function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '') : String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

const iso = (ms: number | null | undefined) => (ms == null ? '' : new Date(ms).toISOString());

export function workoutHistoryCsv(db: AppDb): string {
  const rows = db
    .select({ s: schema.workoutSessions, we: schema.workoutExercises, set: schema.workoutSets })
    .from(schema.workoutSets)
    .innerJoin(schema.workoutExercises, eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId))
    .innerJoin(schema.workoutSessions, eq(schema.workoutSessions.id, schema.workoutExercises.sessionId))
    .where(eq(schema.workoutSessions.status, 'completed'))
    .orderBy(desc(schema.workoutSessions.startedAt), asc(schema.workoutExercises.position), asc(schema.workoutSets.setNumber))
    .all();
  return toCsv(
    ['workout_id', 'workout_name', 'started_at', 'ended_at', 'exercise', 'muscle', 'set_number', 'set_type', 'weight_kg', 'reps', 'rpe', 'volume_kg', 'estimated_1rm_kg', 'completed_at'],
    rows.map(({ s, we, set }) => [
      s.id,
      s.name,
      iso(s.startedAt),
      iso(s.endedAt),
      we.exerciseName,
      we.primaryMuscle,
      set.setNumber,
      set.setType,
      set.weightKg,
      set.reps,
      set.rpe,
      (set.weightKg ?? 0) * (set.reps ?? 0),
      set.weightKg && set.reps ? estimateOneRepMax(set.weightKg, set.reps) : null,
      iso(set.completedAt),
    ]),
  );
}

export function measurementsCsv(db: AppDb): string {
  const rows = db.select().from(schema.bodyMeasurements).orderBy(desc(schema.bodyMeasurements.measuredAt)).all();
  const cols = ['weightKg', 'bodyFatPct', 'chestCm', 'waistCm', 'hipsCm', 'leftArmCm', 'rightArmCm', 'leftThighCm', 'rightThighCm', 'leftCalfCm', 'rightCalfCm', 'neckCm'] as const;
  return toCsv(
    ['measured_at', 'weight_kg', 'body_fat_pct', 'chest_cm', 'waist_cm', 'hips_cm', 'left_arm_cm', 'right_arm_cm', 'left_thigh_cm', 'right_thigh_cm', 'left_calf_cm', 'right_calf_cm', 'neck_cm', 'notes'],
    rows.map((r) => [iso(r.measuredAt), ...cols.map((c) => r[c]), r.notes]),
  );
}

export function nutritionCsv(db: AppDb): string {
  const rows = db.select().from(schema.nutritionEntries).orderBy(desc(schema.nutritionEntries.loggedAt)).all();
  return toCsv(
    ['logged_at', 'meal', 'food', 'quantity_servings', 'serving_size', 'serving_unit', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
    rows.map((r) => [
      iso(r.loggedAt),
      r.meal,
      r.foodName,
      r.quantity,
      r.servingSize,
      r.servingUnit,
      r.caloriesPerServing * r.quantity,
      r.proteinPerServing * r.quantity,
      r.carbsPerServing * r.quantity,
      r.fatPerServing * r.quantity,
    ]),
  );
}

export function personalRecordsCsv(db: AppDb): string {
  const rows = db
    .select({ r: schema.personalRecords, name: schema.exercises.name })
    .from(schema.personalRecords)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId))
    .orderBy(asc(schema.exercises.name))
    .all();
  return toCsv(
    ['exercise', 'record_type', 'value', 'is_estimate', 'weight_kg', 'reps', 'achieved_at'],
    rows.map(({ r, name }) => [name, r.recordType, r.value, r.isEstimate ? 'yes' : 'no', r.weightKg, r.reps, iso(r.achievedAt)]),
  );
}
