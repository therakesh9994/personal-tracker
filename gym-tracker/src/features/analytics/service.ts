/**
 * Analytics queries. All charts are computed from real SQLite rows; aggregation
 * happens in SQL where possible so large histories stay responsive.
 */
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { addMonths, startOfDay, startOfMonth } from 'date-fns';
import {
  exercises,
  nutritionEntries,
  workoutExercises,
  workoutSessions,
  workoutSets,
  type MuscleGroup,
} from '@/database/schema';
import { getDb } from '@/database/client';
import { completedSetCountSql, countedVolumeSql } from '@/features/workouts/repository';
import { estimateOneRepMax, sessionDurationMs } from '@/features/workouts/calculations';
import { countRecordsSetBetween } from '@/features/personal-records/service';
import { weekStart } from '@/utils/time';

export interface SessionStat {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
  volumeKg: number;
  completedSets: number;
}

/** One row per completed session in [since, until). */
export function sessionStats(since = 0, until = Number.MAX_SAFE_INTEGER): SessionStat[] {
  const rows = getDb()
    .select({
      id: workoutSessions.id,
      name: workoutSessions.name,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      totalPausedMs: workoutSessions.totalPausedMs,
      volumeKg: countedVolumeSql,
      completedSets: completedSetCountSql,
    })
    .from(workoutSessions)
    .leftJoin(workoutExercises, eq(workoutExercises.sessionId, workoutSessions.id))
    .leftJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .where(and(eq(workoutSessions.status, 'completed'), gte(workoutSessions.startedAt, since), lt(workoutSessions.startedAt, until)))
    .groupBy(workoutSessions.id)
    .orderBy(asc(workoutSessions.startedAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startedAt: r.startedAt,
    durationMs: sessionDurationMs({ startedAt: r.startedAt, endedAt: r.endedAt, pausedAt: null, totalPausedMs: r.totalPausedMs }),
    volumeKg: Number(r.volumeKg),
    completedSets: Number(r.completedSets),
  }));
}

export interface Bucket {
  key: number;
  workouts: number;
  volumeKg: number;
  durationMs: number;
}

export function bucketSessions(stats: SessionStat[], bucketOf: (ms: number) => number): Bucket[] {
  const map = new Map<number, Bucket>();
  for (const s of stats) {
    const key = bucketOf(s.startedAt);
    const b = map.get(key) ?? { key, workouts: 0, volumeKg: 0, durationMs: 0 };
    b.workouts += 1;
    b.volumeKg += s.volumeKg;
    b.durationMs += s.durationMs;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => a.key - b.key);
}

/** Fill empty buckets between first and last key so bar charts show gaps. */
export function fillBuckets(buckets: Bucket[], start: number, end: number, next: (ms: number) => number): Bucket[] {
  const map = new Map(buckets.map((b) => [b.key, b]));
  const out: Bucket[] = [];
  for (let k = start; k <= end; k = next(k)) out.push(map.get(k) ?? { key: k, workouts: 0, volumeKg: 0, durationMs: 0 });
  return out;
}

export const weeklyBuckets = (stats: SessionStat[]) => bucketSessions(stats, weekStart);
export const monthlyBuckets = (stats: SessionStat[]) => bucketSessions(stats, (ms) => startOfMonth(ms).getTime());
export const dailyBuckets = (stats: SessionStat[]) => bucketSessions(stats, (ms) => startOfDay(ms).getTime());

/** Counted sets per primary muscle (snapshot on the workout exercise). */
export function muscleDistribution(since = 0, until = Number.MAX_SAFE_INTEGER): { muscle: MuscleGroup; sets: number }[] {
  return getDb()
    .select({ muscle: workoutExercises.primaryMuscle, sets: sql<number>`count(*)` })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(
      and(
        eq(workoutSessions.status, 'completed'),
        gte(workoutSessions.startedAt, since),
        lt(workoutSessions.startedAt, until),
        eq(workoutSets.isCompleted, true),
        sql`${workoutSets.setType} != 'warmup'`,
      ),
    )
    .groupBy(workoutExercises.primaryMuscle)
    .orderBy(desc(sql`count(*)`))
    .all()
    .map((r) => ({ muscle: r.muscle, sets: Number(r.sets) }));
}

export interface ExerciseSessionPoint {
  sessionId: string;
  date: number;
  maxWeightKg: number;
  bestE1rm: number;
  bestReps: number;
  volumeKg: number;
}

/** Per-session strength metrics for one exercise. */
export function exerciseProgress(exerciseId: string, since = 0): ExerciseSessionPoint[] {
  const rows = getDb()
    .select({
      sessionId: workoutSessions.id,
      date: workoutSessions.startedAt,
      weightKg: workoutSets.weightKg,
      reps: workoutSets.reps,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(workoutSessions.status, 'completed'),
        gte(workoutSessions.startedAt, since),
        eq(workoutSets.isCompleted, true),
        sql`${workoutSets.setType} != 'warmup'`,
      ),
    )
    .orderBy(asc(workoutSessions.startedAt))
    .all();
  const map = new Map<string, ExerciseSessionPoint>();
  for (const r of rows) {
    const w = r.weightKg ?? 0;
    const reps = r.reps ?? 0;
    const p = map.get(r.sessionId) ?? { sessionId: r.sessionId, date: r.date, maxWeightKg: 0, bestE1rm: 0, bestReps: 0, volumeKg: 0 };
    p.maxWeightKg = Math.max(p.maxWeightKg, w);
    p.bestE1rm = Math.max(p.bestE1rm, estimateOneRepMax(w, reps));
    p.bestReps = Math.max(p.bestReps, reps);
    p.volumeKg += w * reps;
    map.set(r.sessionId, p);
  }
  return [...map.values()];
}

/** Exercises that appear in completed workouts (for the strength chart picker). */
export function trainedExercises(): { id: string; name: string; sessions: number }[] {
  return getDb()
    .select({ id: exercises.id, name: exercises.name, sessions: sql<number>`count(distinct ${workoutExercises.sessionId})` })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(eq(workoutSessions.status, 'completed'))
    .groupBy(exercises.id)
    .orderBy(desc(sql`count(distinct ${workoutExercises.sessionId})`))
    .all()
    .map((r) => ({ ...r, sessions: Number(r.sessions) }));
}

export interface NutritionDay {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const localDay = sql<string>`date(${nutritionEntries.loggedAt} / 1000, 'unixepoch', 'localtime')`;

export function nutritionDaily(since = 0): NutritionDay[] {
  return getDb()
    .select({
      day: localDay,
      calories: sql<number>`sum(${nutritionEntries.caloriesPerServing} * ${nutritionEntries.quantity})`,
      protein: sql<number>`sum(${nutritionEntries.proteinPerServing} * ${nutritionEntries.quantity})`,
      carbs: sql<number>`sum(${nutritionEntries.carbsPerServing} * ${nutritionEntries.quantity})`,
      fat: sql<number>`sum(${nutritionEntries.fatPerServing} * ${nutritionEntries.quantity})`,
    })
    .from(nutritionEntries)
    .where(gte(nutritionEntries.loggedAt, since))
    .groupBy(localDay)
    .orderBy(asc(localDay))
    .all()
    .map((r) => ({ day: r.day, calories: Number(r.calories), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat) }));
}

/** Average calories per logged day, grouped by week (Monday start). */
export function weeklyCalorieAverages(days: NutritionDay[]): { week: number; avgCalories: number; days: number }[] {
  const map = new Map<number, { total: number; n: number }>();
  for (const d of days) {
    const [y, m, dd] = d.day.split('-').map(Number);
    const wk = weekStart(new Date(y, m - 1, dd).getTime());
    const cur = map.get(wk) ?? { total: 0, n: 0 };
    cur.total += d.calories;
    cur.n += 1;
    map.set(wk, cur);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([week, v]) => ({ week, avgCalories: v.total / v.n, days: v.n }));
}

export interface MonthlyReport {
  monthStart: number;
  workouts: number;
  volumeKg: number;
  durationMs: number;
  completedSets: number;
  recordsSet: number;
  avgCalories: number | null;
  loggedNutritionDays: number;
}

export function monthlyReport(monthStartMs: number): MonthlyReport {
  const start = startOfMonth(monthStartMs).getTime();
  const end = addMonths(start, 1).getTime();
  const stats = sessionStats(start, end);
  // Replayed from set history: the personal_records table only holds current bests.
  const recordsSet = countRecordsSetBetween(getDb(), start, end);
  const nutrition = nutritionDaily(start).filter((d) => {
    const [y, m] = d.day.split('-').map(Number);
    return new Date(y, m - 1, 1).getTime() === start;
  });
  return {
    monthStart: start,
    workouts: stats.length,
    volumeKg: stats.reduce((s, x) => s + x.volumeKg, 0),
    durationMs: stats.reduce((s, x) => s + x.durationMs, 0),
    completedSets: stats.reduce((s, x) => s + x.completedSets, 0),
    recordsSet,
    avgCalories: nutrition.length ? nutrition.reduce((s, d) => s + d.calories, 0) / nutrition.length : null,
    loggedNutritionDays: nutrition.length,
  };
}
