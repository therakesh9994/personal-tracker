import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  exercises,
  planDays,
  planExercises,
  workoutPlans,
  workoutSessions,
  type PlanDay,
  type PlanExercise,
  type WorkoutPlan,
} from '@/database/schema';
import { getDb } from '@/database/client';
import type { AppDb } from '@/database/types';
import { AppError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';

export interface PlanSummary extends WorkoutPlan {
  dayCount: number;
  exerciseCount: number;
}

export interface PlanExerciseDetail extends PlanExercise {
  exerciseName: string;
  primaryMuscle: string;
}

export interface PlanDayDetail extends PlanDay {
  exercises: PlanExerciseDetail[];
}

export interface PlanDetail {
  plan: WorkoutPlan;
  days: PlanDayDetail[];
}

const planSchema = z.object({
  name: z.string().trim().min(1, 'Plan name cannot be empty.').max(80, 'Plan name is too long.'),
  description: z.string().trim().max(500).default(''),
});

const dayNameSchema = z.string().trim().min(1, 'Day name cannot be empty.').max(60);

export const targetsSchema = z
  .object({
    targetSets: z.number().int().min(1, 'At least 1 set.').max(20, 'At most 20 sets.'),
    targetReps: z.number().int().min(1, 'At least 1 rep.').max(1000),
    targetRepsMax: z.number().int().min(1).max(1000).nullable(),
    restSeconds: z.number().int().min(0).max(1800),
    targetWeightKg: z.number().min(0).max(1500).nullable(),
  })
  .partial()
  .refine((v) => v.targetRepsMax == null || v.targetReps == null || v.targetRepsMax >= v.targetReps, {
    message: 'Max reps must be greater than or equal to min reps.',
  });

export function listPlans(): PlanSummary[] {
  const db = getDb();
  const plans = db.select().from(workoutPlans).orderBy(asc(workoutPlans.isTemplate), desc(workoutPlans.updatedAt)).all();
  const counts = db
    .select({
      planId: planDays.planId,
      days: sql<number>`count(distinct ${planDays.id})`,
      exercises: sql<number>`count(${planExercises.id})`,
    })
    .from(planDays)
    .leftJoin(planExercises, eq(planExercises.planDayId, planDays.id))
    .groupBy(planDays.planId)
    .all();
  const map = new Map(counts.map((c) => [c.planId, c]));
  return plans.map((p) => ({ ...p, dayCount: Number(map.get(p.id)?.days ?? 0), exerciseCount: Number(map.get(p.id)?.exercises ?? 0) }));
}

export function getPlanDetail(planId: string, db: AppDb = getDb()): PlanDetail | null {
  const plan = db.select().from(workoutPlans).where(eq(workoutPlans.id, planId)).get();
  if (!plan) return null;
  const days = db.select().from(planDays).where(eq(planDays.planId, planId)).orderBy(asc(planDays.position)).all();
  const items =
    days.length === 0
      ? []
      : db
          .select({ pe: planExercises, name: exercises.name, muscle: exercises.primaryMuscle })
          .from(planExercises)
          .innerJoin(exercises, eq(exercises.id, planExercises.exerciseId))
          .where(
            inArray(
              planExercises.planDayId,
              days.map((d) => d.id),
            ),
          )
          .orderBy(asc(planExercises.position))
          .all();
  return {
    plan,
    days: days.map((d) => ({
      ...d,
      exercises: items
        .filter((i) => i.pe.planDayId === d.id)
        .map((i) => ({ ...i.pe, exerciseName: i.name, primaryMuscle: i.muscle })),
    })),
  };
}

export function createPlan(input: { name: string; description?: string }): string {
  const v = validate(planSchema, input);
  const nowMs = Date.now();
  const id = newId();
  getDb().transaction((tx) => {
    tx.insert(workoutPlans).values({ id, name: v.name, description: v.description, createdAt: nowMs, updatedAt: nowMs }).run();
    tx.insert(planDays).values({ id: newId(), planId: id, name: 'Day 1', position: 0, createdAt: nowMs, updatedAt: nowMs }).run();
  });
  notifyDataChanged();
  return id;
}

export function updatePlan(planId: string, input: { name: string; description?: string }): void {
  const v = validate(planSchema, input);
  getDb().update(workoutPlans).set({ name: v.name, description: v.description, updatedAt: Date.now() }).where(eq(workoutPlans.id, planId)).run();
  notifyDataChanged();
}

/** Deep copy of a plan (days + exercises). The copy is always a user plan. */
export function duplicatePlan(planId: string): string {
  const db = getDb();
  const nowMs = Date.now();
  const newPlanId = newId();
  db.transaction((tx) => {
    const detail = getPlanDetail(planId, tx);
    if (!detail) throw new AppError('Plan not found.', 'not_found');
    tx.insert(workoutPlans)
      .values({ id: newPlanId, name: `${detail.plan.name} (copy)`.slice(0, 80), description: detail.plan.description, isTemplate: false, createdAt: nowMs, updatedAt: nowMs })
      .run();
    for (const d of detail.days) {
      const dayId = newId();
      tx.insert(planDays).values({ id: dayId, planId: newPlanId, name: d.name, position: d.position, dayOfWeek: d.dayOfWeek, createdAt: nowMs, updatedAt: nowMs }).run();
      for (const e of d.exercises) {
        tx.insert(planExercises)
          .values({
            id: newId(),
            planDayId: dayId,
            exerciseId: e.exerciseId,
            position: e.position,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            targetRepsMax: e.targetRepsMax,
            restSeconds: e.restSeconds,
            targetWeightKg: e.targetWeightKg,
            createdAt: nowMs,
            updatedAt: nowMs,
          })
          .run();
      }
    }
  });
  notifyDataChanged();
  return newPlanId;
}

/** Deleting a plan keeps workout history (sessions' plan reference is set to null). */
export function deletePlan(planId: string): void {
  getDb().delete(workoutPlans).where(eq(workoutPlans.id, planId)).run();
  notifyDataChanged();
}

function touchPlan(db: AppDb, planId: string) {
  db.update(workoutPlans).set({ updatedAt: Date.now() }).where(eq(workoutPlans.id, planId)).run();
}

export function addDay(planId: string, name?: string): string {
  const db = getDb();
  const nowMs = Date.now();
  const id = newId();
  db.transaction((tx) => {
    const max = tx.select({ m: sql<number | null>`max(${planDays.position})` }).from(planDays).where(eq(planDays.planId, planId)).get();
    const pos = (max?.m ?? -1) + 1;
    tx.insert(planDays).values({ id, planId, name: validate(dayNameSchema, name ?? `Day ${pos + 1}`), position: pos, createdAt: nowMs, updatedAt: nowMs }).run();
    touchPlan(tx, planId);
  });
  notifyDataChanged();
  return id;
}

export function updateDay(dayId: string, patch: { name?: string; dayOfWeek?: number | null }): void {
  const set: Partial<PlanDay> = { updatedAt: Date.now() };
  if (patch.name !== undefined) set.name = validate(dayNameSchema, patch.name);
  if (patch.dayOfWeek !== undefined) {
    if (patch.dayOfWeek !== null && (patch.dayOfWeek < 0 || patch.dayOfWeek > 6)) throw new AppError('Invalid weekday.');
    set.dayOfWeek = patch.dayOfWeek;
  }
  getDb().update(planDays).set(set).where(eq(planDays.id, dayId)).run();
  notifyDataChanged();
}

export function deleteDay(dayId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const day = tx.select().from(planDays).where(eq(planDays.id, dayId)).get();
    if (!day) return;
    tx.delete(planDays).where(eq(planDays.id, dayId)).run();
    tx.update(planDays)
      .set({ position: sql`${planDays.position} - 1` })
      .where(and(eq(planDays.planId, day.planId), gt(planDays.position, day.position)))
      .run();
    touchPlan(tx, day.planId);
  });
  notifyDataChanged();
}

export function addPlanExercise(dayId: string, exerciseId: string, defaults: { restSeconds?: number } = {}): string {
  const db = getDb();
  const nowMs = Date.now();
  const id = newId();
  db.transaction((tx) => {
    const day = tx.select().from(planDays).where(eq(planDays.id, dayId)).get();
    if (!day) throw new AppError('Plan day not found.', 'not_found');
    const ex = tx.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
    if (!ex) throw new AppError('Exercise not found.', 'not_found');
    const max = tx.select({ m: sql<number | null>`max(${planExercises.position})` }).from(planExercises).where(eq(planExercises.planDayId, dayId)).get();
    tx.insert(planExercises)
      .values({
        id,
        planDayId: dayId,
        exerciseId,
        position: (max?.m ?? -1) + 1,
        restSeconds: ex.defaultRestSeconds ?? defaults.restSeconds ?? 90,
        createdAt: nowMs,
        updatedAt: nowMs,
      })
      .run();
    touchPlan(tx, day.planId);
  });
  notifyDataChanged();
  return id;
}

export function updatePlanExercise(id: string, patch: z.input<typeof targetsSchema>): void {
  const v = validate(targetsSchema, patch);
  getDb().update(planExercises).set({ ...v, updatedAt: Date.now() }).where(eq(planExercises.id, id)).run();
  notifyDataChanged();
}

export function removePlanExercise(id: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const pe = tx.select().from(planExercises).where(eq(planExercises.id, id)).get();
    if (!pe) return;
    tx.delete(planExercises).where(eq(planExercises.id, id)).run();
    tx.update(planExercises)
      .set({ position: sql`${planExercises.position} - 1` })
      .where(and(eq(planExercises.planDayId, pe.planDayId), gt(planExercises.position, pe.position)))
      .run();
  });
  notifyDataChanged();
}

export function movePlanExercise(id: string, direction: -1 | 1): void {
  const db = getDb();
  db.transaction((tx) => {
    const pe = tx.select().from(planExercises).where(eq(planExercises.id, id)).get();
    if (!pe) return;
    const list = tx.select().from(planExercises).where(eq(planExercises.planDayId, pe.planDayId)).orderBy(asc(planExercises.position)).all();
    const idx = list.findIndex((x) => x.id === id);
    const other = list[idx + direction];
    if (!other) return;
    tx.update(planExercises).set({ position: other.position }).where(eq(planExercises.id, pe.id)).run();
    tx.update(planExercises).set({ position: pe.position }).where(eq(planExercises.id, other.id)).run();
  });
  notifyDataChanged();
}

export interface TodaysPlan {
  planId: string;
  planName: string;
  day: PlanDay;
  exerciseCount: number;
  reason: 'scheduled' | 'next_in_rotation';
}

/**
 * Today's workout: a plan day scheduled for today's weekday, otherwise the day after
 * the most recently trained plan day (rotation).
 */
export function getTodaysPlan(nowMs = Date.now()): TodaysPlan | null {
  const db = getDb();
  const weekday = new Date(nowMs).getDay();
  const withCount = (day: PlanDay, reason: TodaysPlan['reason']): TodaysPlan => {
    const plan = db.select().from(workoutPlans).where(eq(workoutPlans.id, day.planId)).get()!;
    const n = db.select({ n: sql<number>`count(*)` }).from(planExercises).where(eq(planExercises.planDayId, day.id)).get();
    return { planId: plan.id, planName: plan.name, day, exerciseCount: Number(n?.n ?? 0), reason };
  };
  const scheduled = db.select().from(planDays).where(eq(planDays.dayOfWeek, weekday)).orderBy(asc(planDays.position)).limit(1).get();
  if (scheduled) return withCount(scheduled, 'scheduled');

  const last = db
    .select({ planId: workoutSessions.planId, planDayId: workoutSessions.planDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'completed'), isNotNull(workoutSessions.planDayId)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1)
    .get();
  if (!last?.planId || !last.planDayId) return null;
  const days = db.select().from(planDays).where(eq(planDays.planId, last.planId)).orderBy(asc(planDays.position)).all();
  if (days.length === 0) return null;
  const idx = days.findIndex((d) => d.id === last.planDayId);
  return withCount(days[(idx + 1) % days.length], 'next_in_rotation');
}
