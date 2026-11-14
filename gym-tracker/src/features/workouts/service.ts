/**
 * Workout engine. Every change is persisted to SQLite immediately, so an
 * unfinished workout survives app kills and device restarts and can be resumed.
 */
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  exercises,
  planDays,
  planExercises,
  workoutExercises,
  workoutNotes,
  workoutSessions,
  workoutSets,
  SET_TYPES,
  type SetType,
  type WorkoutSession,
  type WorkoutSet,
} from '@/database/schema';
import { getDb } from '@/database/client';
import type { AppDb } from '@/database/types';
import { AppError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';
import { recalculateRecords, recordsForExercises } from '@/features/personal-records/service';
import * as repo from './repository';

export class ActiveWorkoutExistsError extends AppError {
  constructor(public readonly sessionId: string) {
    super('You already have a workout in progress. Finish or cancel it first.', 'active_workout_exists');
  }
}

const nameSchema = z.string().trim().min(1, 'Workout name cannot be empty.').max(80, 'Workout name is too long.');

export const setPatchSchema = z
  .object({
    setType: z.enum(SET_TYPES),
    weightKg: z.number().min(0, 'Weight cannot be negative.').max(1500, 'Weight looks too large.').nullable(),
    reps: z.number().int('Reps must be a whole number.').min(0, 'Reps cannot be negative.').max(10000, 'Reps look too large.').nullable(),
    rpe: z.number().min(1, 'RPE must be between 1 and 10.').max(10, 'RPE must be between 1 and 10.').nullable(),
  })
  .partial();
export type SetPatch = z.infer<typeof setPatchSchema>;

function touchSession(db: AppDb, sessionId: string, nowMs: number) {
  db.update(workoutSessions).set({ updatedAt: nowMs }).where(eq(workoutSessions.id, sessionId)).run();
}

function requireSession(db: AppDb, id: string): WorkoutSession {
  const s = repo.findSession(db, id);
  if (!s) throw new AppError('Workout not found.', 'not_found');
  return s;
}

function isOpen(s: WorkoutSession) {
  return s.status === 'active' || s.status === 'paused';
}

/** Re-number sets 1..n in their current order. */
function renumberSets(db: AppDb, workoutExerciseId: string) {
  const sets = repo.listSetsForExercise(db, workoutExerciseId);
  sets.forEach((s, i) => {
    if (s.setNumber !== i + 1) db.update(workoutSets).set({ setNumber: i + 1 }).where(eq(workoutSets.id, s.id)).run();
  });
}

function insertWorkoutExercise(
  db: AppDb,
  sessionId: string,
  exerciseId: string,
  position: number,
  restSeconds: number | null,
  nowMs: number,
): string {
  const ex = db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
  if (!ex) throw new AppError('Exercise not found.', 'not_found');
  const id = newId();
  db.insert(workoutExercises)
    .values({
      id,
      sessionId,
      exerciseId,
      exerciseName: ex.name,
      primaryMuscle: ex.primaryMuscle,
      position,
      restSeconds: restSeconds ?? ex.defaultRestSeconds ?? null,
      createdAt: nowMs,
      updatedAt: nowMs,
    })
    .run();
  return id;
}

function insertSet(
  db: AppDb,
  workoutExerciseId: string,
  setNumber: number,
  values: { setType?: SetType; weightKg?: number | null; reps?: number | null; rpe?: number | null },
  nowMs: number,
): string {
  const id = newId();
  db.insert(workoutSets)
    .values({
      id,
      workoutExerciseId,
      setNumber,
      setType: values.setType ?? 'working',
      weightKg: values.weightKg ?? null,
      reps: values.reps ?? null,
      rpe: values.rpe ?? null,
      isCompleted: false,
      completedAt: null,
      createdAt: nowMs,
      updatedAt: nowMs,
    })
    .run();
  return id;
}

export function getOpenSession(): WorkoutSession | null {
  return repo.findOpenSession(getDb()) ?? null;
}

export function getSessionDetail(sessionId: string) {
  return repo.getSessionDetail(getDb(), sessionId);
}

export interface StartWorkoutInput {
  name?: string;
  planDayId?: string;
  sourceSessionId?: string;
  nowMs?: number;
}

/**
 * Start a workout: empty, from a plan day (targets copied, plan untouched),
 * or from a previous session (exercises + set values copied, not completed).
 */
export function startWorkout(input: StartWorkoutInput = {}): string {
  const db = getDb();
  const nowMs = input.nowMs ?? Date.now();
  const id = db.transaction((tx) => {
    const open = repo.findOpenSession(tx);
    if (open) throw new ActiveWorkoutExistsError(open.id);

    let name = input.name?.trim() || '';
    let planId: string | null = null;
    let planDayId: string | null = null;
    if (input.planDayId) {
      const day = tx.select().from(planDays).where(eq(planDays.id, input.planDayId)).get();
      if (!day) throw new AppError('Plan day not found.', 'not_found');
      planId = day.planId;
      planDayId = day.id;
      name ||= day.name;
    }
    let source: WorkoutSession | undefined;
    if (input.sourceSessionId) {
      source = repo.findSession(tx, input.sourceSessionId);
      if (!source) throw new AppError('Previous workout not found.', 'not_found');
      name ||= source.name;
    }
    name ||= defaultWorkoutName(nowMs);
    validate(nameSchema, name);

    const sessionId = newId();
    tx.insert(workoutSessions)
      .values({
        id: sessionId,
        name,
        status: 'active',
        planId,
        planDayId,
        sourceSessionId: source?.id ?? null,
        startedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
      })
      .run();

    if (planDayId) {
      const items = tx
        .select()
        .from(planExercises)
        .where(eq(planExercises.planDayId, planDayId))
        .orderBy(asc(planExercises.position))
        .all();
      items.forEach((pe, i) => {
        const weId = insertWorkoutExercise(tx, sessionId, pe.exerciseId, i, pe.restSeconds, nowMs);
        for (let n = 1; n <= pe.targetSets; n++) {
          insertSet(tx, weId, n, { weightKg: pe.targetWeightKg, reps: pe.targetReps }, nowMs);
        }
      });
    } else if (source) {
      const detail = repo.getSessionDetail(tx, source.id)!;
      detail.exercises.forEach((ex, i) => {
        const weId = insertWorkoutExercise(tx, sessionId, ex.exerciseId, i, ex.restSeconds, nowMs);
        const toCopy = ex.sets.filter((s) => s.isCompleted);
        (toCopy.length ? toCopy : ex.sets).forEach((s, n) => {
          insertSet(tx, weId, n + 1, { setType: s.setType, weightKg: s.weightKg, reps: s.reps }, nowMs);
        });
      });
    }
    return sessionId;
  });
  notifyDataChanged();
  return id;
}

export function defaultWorkoutName(nowMs: number): string {
  const h = new Date(nowMs).getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

export function renameSession(sessionId: string, name: string): void {
  const valid = validate(nameSchema, name);
  const db = getDb();
  requireSession(db, sessionId);
  db.update(workoutSessions).set({ name: valid, updatedAt: Date.now() }).where(eq(workoutSessions.id, sessionId)).run();
  notifyDataChanged();
}

/** Add an exercise; pre-fills one set from previous performance when available. */
export function addExercise(sessionId: string, exerciseId: string, nowMs = Date.now()): string {
  const db = getDb();
  const id = db.transaction((tx) => {
    requireSession(tx, sessionId);
    const pos = repo.maxExercisePosition(tx, sessionId) + 1;
    const weId = insertWorkoutExercise(tx, sessionId, exerciseId, pos, null, nowMs);
    const prev = repo.findPreviousPerformance(tx, exerciseId, sessionId);
    const firstWorking = prev?.sets.find((s) => s.setType !== 'warmup') ?? prev?.sets[0];
    insertSet(tx, weId, 1, { weightKg: firstWorking?.weightKg ?? null, reps: firstWorking?.reps ?? null }, nowMs);
    touchSession(tx, sessionId, nowMs);
    return weId;
  });
  notifyDataChanged();
  return id;
}

export function removeExercise(workoutExerciseId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const we = repo.findWorkoutExercise(tx, workoutExerciseId);
    if (!we) return;
    const session = requireSession(tx, we.sessionId);
    tx.delete(workoutExercises).where(eq(workoutExercises.id, workoutExerciseId)).run();
    // close the gap in positions
    tx.update(workoutExercises)
      .set({ position: sql`${workoutExercises.position} - 1` })
      .where(and(eq(workoutExercises.sessionId, we.sessionId), gt(workoutExercises.position, we.position)))
      .run();
    if (session.status === 'completed') recalculateRecords(tx, [we.exerciseId]);
    touchSession(tx, we.sessionId, Date.now());
  });
  notifyDataChanged();
}

/** Move an exercise up (-1) or down (+1) in the session order. */
export function moveExercise(workoutExerciseId: string, direction: -1 | 1): void {
  const db = getDb();
  db.transaction((tx) => {
    const we = repo.findWorkoutExercise(tx, workoutExerciseId);
    if (!we) return;
    const list = repo.listSessionExercises(tx, we.sessionId);
    const idx = list.findIndex((e) => e.id === we.id);
    const target = idx + direction;
    if (target < 0 || target >= list.length) return;
    const other = list[target];
    tx.update(workoutExercises).set({ position: other.position }).where(eq(workoutExercises.id, we.id)).run();
    tx.update(workoutExercises).set({ position: we.position }).where(eq(workoutExercises.id, other.id)).run();
  });
  notifyDataChanged();
}

/** Add a set. By default duplicates the previous set's type/weight/reps. */
export function addSet(workoutExerciseId: string, options: { duplicatePrevious?: boolean } = {}): string {
  const db = getDb();
  const nowMs = Date.now();
  const id = db.transaction((tx) => {
    const we = repo.findWorkoutExercise(tx, workoutExerciseId);
    if (!we) throw new AppError('Exercise not found in this workout.', 'not_found');
    const sets = repo.listSetsForExercise(tx, workoutExerciseId);
    const last = sets[sets.length - 1];
    const copy = options.duplicatePrevious !== false && last;
    const setId = insertSet(
      tx,
      workoutExerciseId,
      sets.length + 1,
      copy ? { setType: last.setType === 'warmup' ? 'working' : last.setType, weightKg: last.weightKg, reps: last.reps, rpe: last.rpe } : {},
      nowMs,
    );
    touchSession(tx, we.sessionId, nowMs);
    return setId;
  });
  notifyDataChanged();
  return id;
}

function afterHistoricalChange(tx: AppDb, setRow: WorkoutSet) {
  const we = repo.findWorkoutExercise(tx, setRow.workoutExerciseId);
  if (!we) return;
  const session = repo.findSession(tx, we.sessionId);
  if (session?.status === 'completed') recalculateRecords(tx, [we.exerciseId]);
  touchSession(tx, we.sessionId, Date.now());
}

/** Update set fields. Editing a set from a completed workout recalculates that exercise's records. */
export function updateSet(setId: string, patch: SetPatch): void {
  const valid = validate(setPatchSchema, patch);
  const db = getDb();
  db.transaction((tx) => {
    const existing = repo.findSet(tx, setId);
    if (!existing) throw new AppError('Set not found.', 'not_found');
    const update: Partial<WorkoutSet> = { ...valid, updatedAt: Date.now() };
    // A completed set must have reps. Clearing them (or setting 0) un-completes the set,
    // so it can't be counted as a completed 0-rep set in volume, history or records.
    if (existing.isCompleted && 'reps' in valid && (valid.reps == null || valid.reps <= 0)) {
      update.isCompleted = false;
      update.completedAt = null;
    }
    tx.update(workoutSets).set(update).where(eq(workoutSets.id, setId)).run();
    afterHistoricalChange(tx, existing);
  });
  notifyDataChanged();
}

export function setCompleted(setId: string, completed: boolean, nowMs = Date.now()): void {
  const db = getDb();
  db.transaction((tx) => {
    const existing = repo.findSet(tx, setId);
    if (!existing) throw new AppError('Set not found.', 'not_found');
    if (completed && (existing.reps == null || existing.reps <= 0)) {
      throw new AppError('Enter the number of reps before completing the set.', 'validation');
    }
    tx.update(workoutSets)
      .set({ isCompleted: completed, completedAt: completed ? nowMs : null, updatedAt: nowMs })
      .where(eq(workoutSets.id, setId))
      .run();
    afterHistoricalChange(tx, existing);
  });
  notifyDataChanged();
}

export function deleteSet(setId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const existing = repo.findSet(tx, setId);
    if (!existing) return;
    tx.delete(workoutSets).where(eq(workoutSets.id, setId)).run();
    renumberSets(tx, existing.workoutExerciseId);
    afterHistoricalChange(tx, existing);
  });
  notifyDataChanged();
}

export function pauseSession(sessionId: string, nowMs = Date.now()): void {
  const db = getDb();
  const s = requireSession(db, sessionId);
  if (s.status !== 'active') return;
  db.update(workoutSessions).set({ status: 'paused', pausedAt: nowMs, updatedAt: nowMs }).where(eq(workoutSessions.id, sessionId)).run();
  notifyDataChanged();
}

export function resumeSession(sessionId: string, nowMs = Date.now()): void {
  const db = getDb();
  const s = requireSession(db, sessionId);
  if (s.status !== 'paused') return;
  const pausedFor = s.pausedAt != null ? Math.max(0, nowMs - s.pausedAt) : 0;
  db.update(workoutSessions)
    .set({ status: 'active', pausedAt: null, totalPausedMs: s.totalPausedMs + pausedFor, updatedAt: nowMs })
    .where(eq(workoutSessions.id, sessionId))
    .run();
  notifyDataChanged();
}

export interface FinishResult {
  sessionId: string;
  alreadyFinished: boolean;
  discardedSets: number;
  newRecordCount: number;
}

/**
 * Finish a workout in one transaction: drop incomplete sets and empty exercises,
 * close any pause, mark completed, and recalculate personal records.
 * Idempotent: finishing an already-completed session is a no-op (duplicate taps).
 */
export function finishSession(sessionId: string, nowMs = Date.now()): FinishResult {
  const result = getDb().transaction((tx) => finishSessionTx(tx, sessionId, nowMs));
  notifyDataChanged();
  return result;
}

/**
 * Finish logic, run inside the caller's transaction. Requires at least one completed set:
 * a workout with no exercises, no sets, or only incomplete sets cannot be saved.
 */
export function finishSessionTx(tx: AppDb, sessionId: string, nowMs: number): FinishResult {
  const s = requireSession(tx, sessionId);
  if (!isOpen(s)) return { sessionId, alreadyFinished: true, discardedSets: 0, newRecordCount: 0 };

  const exs = repo.listSessionExercises(tx, sessionId);
  const sets = repo.listSetsForExercises(
    tx,
    exs.map((e) => e.id),
  );
  const incomplete = sets.filter((x) => !x.isCompleted);
  if (sets.length === incomplete.length) {
    throw new AppError('Complete at least one set before finishing, or cancel the workout.', 'validation');
  }
  for (const x of incomplete) tx.delete(workoutSets).where(eq(workoutSets.id, x.id)).run();
  const remaining = new Set(sets.filter((x) => x.isCompleted).map((x) => x.workoutExerciseId));
  let pos = 0;
  for (const e of exs) {
    if (!remaining.has(e.id)) {
      tx.delete(workoutExercises).where(eq(workoutExercises.id, e.id)).run();
    } else {
      if (e.position !== pos) tx.update(workoutExercises).set({ position: pos }).where(eq(workoutExercises.id, e.id)).run();
      renumberSets(tx, e.id);
      pos++;
    }
  }

  const pausedFor = s.pausedAt != null ? Math.max(0, nowMs - s.pausedAt) : 0;
  tx.update(workoutSessions)
    .set({ status: 'completed', endedAt: nowMs, pausedAt: null, totalPausedMs: s.totalPausedMs + pausedFor, updatedAt: nowMs })
    .where(eq(workoutSessions.id, sessionId))
    .run();

  const exerciseIds = [...new Set(exs.map((e) => e.exerciseId))];
  recalculateRecords(tx, exerciseIds, nowMs);
  const newRecordCount = recordsForExercises(tx, exerciseIds).filter((r) => r.sessionId === sessionId).length;
  return { sessionId, alreadyFinished: false, discardedSets: incomplete.length, newRecordCount };
}

/**
 * Enforce the "at most one open workout" invariant (e.g. after merging a backup).
 * The most recently started open workout stays open. Older ones are finished at
 * their last completed set; ones with no completed sets hold nothing to save and are removed.
 * Returns how many sessions were closed or removed.
 */
export function resolveDuplicateOpenSessions(tx: AppDb): number {
  const open = tx
    .select()
    .from(workoutSessions)
    .where(inArray(workoutSessions.status, ['active', 'paused']))
    .orderBy(desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .all();
  for (const extra of open.slice(1)) {
    const sets = repo.listSetsForExercises(
      tx,
      repo.listSessionExercises(tx, extra.id).map((e) => e.id),
    );
    const done = sets.filter((x) => x.isCompleted);
    if (done.length === 0) {
      tx.delete(workoutSessions).where(eq(workoutSessions.id, extra.id)).run();
    } else {
      const endedAt = Math.max(extra.startedAt, ...done.map((x) => x.completedAt ?? extra.startedAt));
      finishSessionTx(tx, extra.id, endedAt);
    }
  }
  return Math.max(0, open.length - 1);
}

/** Cancel (discard) an in-progress workout. The UI must confirm first. */
export function cancelSession(sessionId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const s = repo.findSession(tx, sessionId);
    if (!s) return;
    if (!isOpen(s)) throw new AppError('Only an in-progress workout can be cancelled.', 'validation');
    tx.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
  });
  notifyDataChanged();
}

/** Delete a completed workout from history and recalculate affected records. */
export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const ids = repo.exerciseIdsInSession(tx, sessionId);
    tx.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
    recalculateRecords(tx, ids);
  });
  notifyDataChanged();
}

/** Upsert a note for the session (workoutExerciseId = null) or one exercise. Empty text deletes it. */
export function saveNote(sessionId: string, content: string, workoutExerciseId: string | null = null): void {
  const db = getDb();
  const text = content.trim();
  const nowMs = Date.now();
  db.transaction((tx) => {
    requireSession(tx, sessionId);
    const existing = repo.findNote(tx, sessionId, workoutExerciseId);
    if (!text) {
      if (existing) tx.delete(workoutNotes).where(eq(workoutNotes.id, existing.id)).run();
      return;
    }
    if (existing) {
      tx.update(workoutNotes).set({ content: text, updatedAt: nowMs }).where(eq(workoutNotes.id, existing.id)).run();
    } else {
      tx.insert(workoutNotes)
        .values({ id: newId(), sessionId, workoutExerciseId, content: text, createdAt: nowMs, updatedAt: nowMs })
        .run();
    }
  });
  notifyDataChanged();
}

export function setExerciseRest(workoutExerciseId: string, restSeconds: number | null): void {
  getDb().update(workoutExercises).set({ restSeconds, updatedAt: Date.now() }).where(eq(workoutExercises.id, workoutExerciseId)).run();
  notifyDataChanged();
}

export function listHistory(opts: { limit: number; after?: repo.HistoryCursor }) {
  return repo.listHistory(getDb(), opts);
}

export function getPreviousPerformance(exerciseId: string, excludeSessionId?: string) {
  return repo.findPreviousPerformance(getDb(), exerciseId, excludeSessionId);
}

export function getExerciseHistory(exerciseId: string, limit?: number) {
  return repo.listExerciseHistory(getDb(), exerciseId, limit);
}
