import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { addMonths, startOfMonth } from 'date-fns';
import {
  exercises,
  personalRecords,
  workoutExercises,
  workoutSessions,
  workoutSets,
  type PersonalRecord,
  type RecordType,
} from '@/database/schema';
import type { AppDb } from '@/database/types';
import { getDb } from '@/database/client';
import { newId } from '@/utils/id';
import { estimateOneRepMax } from '@/features/workouts/calculations';

export const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: 'Heaviest weight',
  max_reps: 'Most reps (single set)',
  estimated_1rm: 'Estimated 1RM (Epley)',
  max_set_volume: 'Best set volume',
  best_session_volume: 'Best session volume',
};

interface Candidate {
  value: number;
  weightKg: number | null;
  reps: number | null;
  workoutSetId: string | null;
  sessionId: string;
  achievedAt: number;
}

export interface ComputedRecord extends Candidate {
  recordType: RecordType;
  isEstimate: boolean;
}

export interface RecordSourceSet {
  setId: string;
  sessionId: string;
  weightKg: number | null;
  reps: number | null;
  achievedAt: number;
}

/**
 * Pure PR computation from counted sets (completed, non-warm-up, in completed sessions),
 * expected in chronological order. Ties keep the earliest achievement.
 */
export function computeRecords(sets: RecordSourceSet[]): ComputedRecord[] {
  const best: Partial<Record<RecordType, Candidate>> = {};
  const consider = (type: RecordType, c: Candidate) => {
    if (c.value <= 0) return;
    const cur = best[type];
    if (!cur || c.value > cur.value + 1e-9) best[type] = c;
  };
  const sessionTotals = new Map<string, { volume: number; achievedAt: number }>();

  for (const s of sets) {
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    const base = { weightKg: s.weightKg, reps: s.reps, workoutSetId: s.setId, sessionId: s.sessionId, achievedAt: s.achievedAt };
    if (r > 0) {
      consider('max_weight', { ...base, value: w });
      consider('max_reps', { ...base, value: r });
      consider('estimated_1rm', { ...base, value: estimateOneRepMax(w, r) });
      consider('max_set_volume', { ...base, value: w * r });
    }
    const t = sessionTotals.get(s.sessionId) ?? { volume: 0, achievedAt: s.achievedAt };
    t.volume += w * r;
    t.achievedAt = Math.max(t.achievedAt, s.achievedAt);
    sessionTotals.set(s.sessionId, t);
  }
  for (const [sessionId, t] of sessionTotals) {
    consider('best_session_volume', { value: t.volume, weightKg: null, reps: null, workoutSetId: null, sessionId, achievedAt: t.achievedAt });
  }

  return (Object.keys(best) as RecordType[]).map((recordType) => ({
    recordType,
    isEstimate: recordType === 'estimated_1rm',
    ...best[recordType]!,
  }));
}

/**
 * Count record-setting events between [start, end) by replaying an exercise's history in
 * order (sets must be chronological, i.e. as returned by loadRecordSourceSets). Each
 * (record type, session) counts once, including first-ever records. Unlike the
 * personal_records table (current bests only), this stays correct for past periods after
 * later sessions beat those records.
 */
export function countRecordEvents(sets: RecordSourceSet[], start: number, end: number): number {
  const best: Partial<Record<RecordType, number>> = {};
  const events = new Set<string>();
  const improve = (type: RecordType, value: number, sessionId: string, at: number) => {
    if (value <= 0) return;
    if (best[type] == null || value > best[type]! + 1e-9) {
      best[type] = value;
      if (at >= start && at < end) events.add(`${type}:${sessionId}`);
    }
  };
  let i = 0;
  while (i < sets.length) {
    // Process one session at a time so session volume is evaluated when the session is complete.
    const sessionId = sets[i].sessionId;
    let volume = 0;
    let lastAt = sets[i].achievedAt;
    for (; i < sets.length && sets[i].sessionId === sessionId; i++) {
      const s = sets[i];
      const w = s.weightKg ?? 0;
      const r = s.reps ?? 0;
      lastAt = Math.max(lastAt, s.achievedAt);
      volume += w * r;
      if (r > 0) {
        improve('max_weight', w, sessionId, s.achievedAt);
        improve('max_reps', r, sessionId, s.achievedAt);
        improve('estimated_1rm', estimateOneRepMax(w, r), sessionId, s.achievedAt);
        improve('max_set_volume', w * r, sessionId, s.achievedAt);
      }
    }
    improve('best_session_volume', volume, sessionId, lastAt);
  }
  return events.size;
}

/** Number of personal records set in [start, end), across all exercises. */
export function countRecordsSetBetween(db: AppDb, start: number, end: number): number {
  const trained = db
    .selectDistinct({ id: workoutExercises.exerciseId })
    .from(workoutExercises)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(and(eq(workoutSessions.status, 'completed'), sql`${workoutSessions.startedAt} >= ${start}`, sql`${workoutSessions.startedAt} < ${end}`))
    .all();
  return trained.reduce((n, { id }) => n + countRecordEvents(loadRecordSourceSets(db, id), start, end), 0);
}

export function loadRecordSourceSets(db: AppDb, exerciseId: string): RecordSourceSet[] {
  return db
    .select({
      setId: workoutSets.id,
      sessionId: workoutSessions.id,
      weightKg: workoutSets.weightKg,
      reps: workoutSets.reps,
      achievedAt: sql<number>`coalesce(${workoutSets.completedAt}, ${workoutSessions.endedAt}, ${workoutSessions.startedAt})`,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(workoutSessions.status, 'completed'),
        eq(workoutSets.isCompleted, true),
        sql`${workoutSets.setType} != 'warmup'`,
      ),
    )
    .orderBy(asc(workoutSessions.startedAt), asc(workoutExercises.position), asc(workoutSets.setNumber))
    .all();
}

/**
 * Recalculate (replace) all records for the given exercises. Call inside the same
 * transaction as the change that affected them (finish, edit, delete).
 */
export function recalculateRecords(db: AppDb, exerciseIds: string[], nowMs = Date.now()): void {
  for (const exerciseId of new Set(exerciseIds)) {
    const computed = computeRecords(loadRecordSourceSets(db, exerciseId));
    db.delete(personalRecords).where(eq(personalRecords.exerciseId, exerciseId)).run();
    for (const r of computed) {
      db.insert(personalRecords)
        .values({
          id: newId(),
          exerciseId,
          recordType: r.recordType,
          value: r.value,
          weightKg: r.weightKg,
          reps: r.reps,
          isEstimate: r.isEstimate,
          workoutSetId: r.workoutSetId,
          sessionId: r.sessionId,
          achievedAt: r.achievedAt,
          createdAt: nowMs,
          updatedAt: nowMs,
        })
        .run();
    }
  }
}

export function recordsForExercises(db: AppDb, exerciseIds: string[]): PersonalRecord[] {
  if (exerciseIds.length === 0) return [];
  return db.select().from(personalRecords).where(inArray(personalRecords.exerciseId, exerciseIds)).all();
}

export interface RecordWithExercise extends PersonalRecord {
  exerciseName: string;
}

export function listAllRecords(): RecordWithExercise[] {
  return getDb()
    .select({ r: personalRecords, exerciseName: exercises.name })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .orderBy(asc(exercises.name))
    .all()
    .map((row) => ({ ...row.r, exerciseName: row.exerciseName }));
}

export function listRecordsForExercise(exerciseId: string): PersonalRecord[] {
  return getDb().select().from(personalRecords).where(eq(personalRecords.exerciseId, exerciseId)).all();
}

export function listRecordsForSession(sessionId: string): RecordWithExercise[] {
  return getDb()
    .select({ r: personalRecords, exerciseName: exercises.name })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(eq(personalRecords.sessionId, sessionId))
    .all()
    .map((row) => ({ ...row.r, exerciseName: row.exerciseName }));
}

export interface RecordSummary {
  thisMonth: number;
  total: number;
}

/** Records set in the calendar month containing `nowMs`, plus how many records are tracked. */
export function recordSummary(nowMs: number = Date.now()): RecordSummary {
  const db = getDb();
  const start = startOfMonth(nowMs).getTime();
  const total = db.select({ n: sql<number>`count(*)` }).from(personalRecords).get();
  return { thisMonth: countRecordsSetBetween(db, start, addMonths(start, 1).getTime()), total: Number(total?.n ?? 0) };
}
