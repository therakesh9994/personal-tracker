import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import {
  workoutExercises,
  workoutNotes,
  workoutSessions,
  workoutSets,
  type WorkoutExercise,
  type WorkoutNote,
  type WorkoutSession,
  type WorkoutSet,
} from '@/database/schema';
import type { AppDb } from '@/database/types';

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
  note: WorkoutNote | null;
}

export interface SessionDetail {
  session: WorkoutSession;
  exercises: WorkoutExerciseWithSets[];
  sessionNote: WorkoutNote | null;
}

/** SQL fragment: volume of counted (completed, non-warm-up) sets. */
export const countedVolumeSql = sql<number>`coalesce(sum(case when ${workoutSets.isCompleted} = 1 and ${workoutSets.setType} != 'warmup' then coalesce(${workoutSets.weightKg}, 0) * coalesce(${workoutSets.reps}, 0) else 0 end), 0)`;
export const completedSetCountSql = sql<number>`coalesce(sum(case when ${workoutSets.isCompleted} = 1 then 1 else 0 end), 0)`;

export function findOpenSession(db: AppDb): WorkoutSession | undefined {
  return db
    .select()
    .from(workoutSessions)
    .where(inArray(workoutSessions.status, ['active', 'paused']))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1)
    .get();
}

export function findSession(db: AppDb, id: string): WorkoutSession | undefined {
  return db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).get();
}

export function findWorkoutExercise(db: AppDb, id: string): WorkoutExercise | undefined {
  return db.select().from(workoutExercises).where(eq(workoutExercises.id, id)).get();
}

export function findSet(db: AppDb, id: string): WorkoutSet | undefined {
  return db.select().from(workoutSets).where(eq(workoutSets.id, id)).get();
}

export function listSessionExercises(db: AppDb, sessionId: string): WorkoutExercise[] {
  return db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.sessionId, sessionId))
    .orderBy(asc(workoutExercises.position))
    .all();
}

export function listSetsForExercises(db: AppDb, workoutExerciseIds: string[]): WorkoutSet[] {
  if (workoutExerciseIds.length === 0) return [];
  return db
    .select()
    .from(workoutSets)
    .where(inArray(workoutSets.workoutExerciseId, workoutExerciseIds))
    .orderBy(asc(workoutSets.setNumber))
    .all();
}

export function listSetsForExercise(db: AppDb, workoutExerciseId: string): WorkoutSet[] {
  return listSetsForExercises(db, [workoutExerciseId]);
}

export function getSessionDetail(db: AppDb, sessionId: string): SessionDetail | null {
  const session = findSession(db, sessionId);
  if (!session) return null;
  const exs = listSessionExercises(db, sessionId);
  const sets = listSetsForExercises(
    db,
    exs.map((e) => e.id),
  );
  const notes = db.select().from(workoutNotes).where(eq(workoutNotes.sessionId, sessionId)).all();
  const setsByEx = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = setsByEx.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByEx.set(s.workoutExerciseId, list);
  }
  return {
    session,
    sessionNote: notes.find((n) => n.workoutExerciseId == null) ?? null,
    exercises: exs.map((e) => ({
      ...e,
      sets: setsByEx.get(e.id) ?? [],
      note: notes.find((n) => n.workoutExerciseId === e.id) ?? null,
    })),
  };
}

export interface HistoryItem {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  totalPausedMs: number;
  exerciseCount: number;
  completedSets: number;
  volumeKg: number;
}

/** Keyset cursor: the last item of the previous page. `id` breaks ties between equal start times. */
export interface HistoryCursor {
  startedAt: number;
  id: string;
}

/**
 * Paginated workout history using keyset pagination on (started_at, id), which is
 * stable when sessions share a start time and fast with 10k+ sessions.
 */
export function listHistory(db: AppDb, opts: { limit: number; after?: HistoryCursor }): HistoryItem[] {
  const c = opts.after;
  const where = c
    ? and(
        eq(workoutSessions.status, 'completed'),
        or(lt(workoutSessions.startedAt, c.startedAt), and(eq(workoutSessions.startedAt, c.startedAt), lt(workoutSessions.id, c.id))),
      )
    : eq(workoutSessions.status, 'completed');
  const sessions = db
    .select()
    .from(workoutSessions)
    .where(where)
    .orderBy(desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .limit(opts.limit)
    .all();
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const stats = db
    .select({
      sessionId: workoutExercises.sessionId,
      exerciseCount: sql<number>`count(distinct ${workoutExercises.id})`,
      completedSets: completedSetCountSql,
      volumeKg: countedVolumeSql,
    })
    .from(workoutExercises)
    .leftJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .where(inArray(workoutExercises.sessionId, ids))
    .groupBy(workoutExercises.sessionId)
    .all();
  const byId = new Map(stats.map((s) => [s.sessionId, s]));
  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    totalPausedMs: s.totalPausedMs,
    exerciseCount: Number(byId.get(s.id)?.exerciseCount ?? 0),
    completedSets: Number(byId.get(s.id)?.completedSets ?? 0),
    volumeKg: Number(byId.get(s.id)?.volumeKg ?? 0),
  }));
}

export interface PreviousPerformance {
  sessionId: string;
  sessionName: string;
  date: number;
  sets: WorkoutSet[];
}

/** Most recent completed session (other than `excludeSessionId`) containing this exercise. */
export function findPreviousPerformance(
  db: AppDb,
  exerciseId: string,
  excludeSessionId?: string,
): PreviousPerformance | null {
  const row = db
    .select({ we: workoutExercises, session: workoutSessions })
    .from(workoutExercises)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(workoutSessions.status, 'completed'),
        excludeSessionId ? ne(workoutSessions.id, excludeSessionId) : undefined,
      ),
    )
    .orderBy(desc(workoutSessions.startedAt), desc(workoutExercises.position))
    .limit(1)
    .get();
  if (!row) return null;
  const sets = listSetsForExercise(db, row.we.id).filter((s) => s.isCompleted);
  return { sessionId: row.session.id, sessionName: row.session.name, date: row.session.startedAt, sets };
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  sessionName: string;
  date: number;
  sets: WorkoutSet[];
}

export function listExerciseHistory(db: AppDb, exerciseId: string, limit = 20): ExerciseHistoryEntry[] {
  const rows = db
    .select({ we: workoutExercises, session: workoutSessions })
    .from(workoutExercises)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExercises.sessionId))
    .where(and(eq(workoutExercises.exerciseId, exerciseId), eq(workoutSessions.status, 'completed')))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit)
    .all();
  const sets = listSetsForExercises(
    db,
    rows.map((r) => r.we.id),
  );
  return rows.map((r) => ({
    sessionId: r.session.id,
    sessionName: r.session.name,
    date: r.session.startedAt,
    sets: sets.filter((s) => s.workoutExerciseId === r.we.id && s.isCompleted),
  }));
}

export function findNote(db: AppDb, sessionId: string, workoutExerciseId: string | null): WorkoutNote | undefined {
  return db
    .select()
    .from(workoutNotes)
    .where(
      and(
        eq(workoutNotes.sessionId, sessionId),
        workoutExerciseId ? eq(workoutNotes.workoutExerciseId, workoutExerciseId) : isNull(workoutNotes.workoutExerciseId),
      ),
    )
    .get();
}

export function maxExercisePosition(db: AppDb, sessionId: string): number {
  const r = db
    .select({ m: sql<number | null>`max(${workoutExercises.position})` })
    .from(workoutExercises)
    .where(eq(workoutExercises.sessionId, sessionId))
    .get();
  return r?.m ?? -1;
}

/** Distinct exercise IDs used in a session (for PR recalculation). */
export function exerciseIdsInSession(db: AppDb, sessionId: string): string[] {
  return db
    .selectDistinct({ id: workoutExercises.exerciseId })
    .from(workoutExercises)
    .where(eq(workoutExercises.sessionId, sessionId))
    .all()
    .map((r) => r.id);
}

/** Day-start timestamps (local) of completed sessions since `since` — used for streaks/frequency. */
export function completedSessionStarts(db: AppDb, since = 0): number[] {
  return db
    .select({ startedAt: workoutSessions.startedAt })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'completed'), sql`${workoutSessions.startedAt} >= ${since}`))
    .orderBy(asc(workoutSessions.startedAt))
    .all()
    .map((r) => r.startedAt);
}

export function countCompletedSessions(db: AppDb, since = 0): number {
  const r = db
    .select({ n: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'completed'), sql`${workoutSessions.startedAt} >= ${since}`))
    .get();
  return Number(r?.n ?? 0);
}
