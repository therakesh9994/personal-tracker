/** Regression tests for code-review findings. */
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/test/testDb';
import { memoryPhotoIO } from '@/test/memoryPhotos';
import * as schema from '@/database/schema';
import { SCHEMA_VERSION } from '@/database/client';
import * as W from '../service';
import { createBackupArchive, restoreBackup } from '@/features/backup/engine';
import { parseBackup } from '@/features/backup/format';
import { countRecordEvents } from '@/features/personal-records/service';
import { monthlyReport } from '@/features/analytics/service';

function doneSet(setId: string, weightKg: number, reps: number) {
  W.updateSet(setId, { weightKg, reps });
  W.setCompleted(setId, true);
}

function workoutWith(weightKg: number, reps: number, nowMs: number) {
  const sid = W.startWorkout({ nowMs });
  W.addExercise(sid, 'ex_bench_press', nowMs);
  const setId = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
  W.updateSet(setId, { weightKg, reps });
  W.setCompleted(setId, true, nowMs);
  W.finishSession(sid, nowMs + 1000);
  return sid;
}

describe('finding: clearing reps on a completed set', () => {
  beforeEach(() => createTestDb());
  it('un-completes the set instead of keeping a completed 0/empty-rep set', () => {
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_bench_press');
    const setId = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
    doneSet(setId, 100, 10);
    W.updateSet(setId, { reps: null });
    expect(W.getSessionDetail(sid)!.exercises[0].sets[0]).toMatchObject({ reps: null, isCompleted: false, completedAt: null });
    doneSet(setId, 100, 10);
    W.updateSet(setId, { reps: 0 });
    expect(W.getSessionDetail(sid)!.exercises[0].sets[0].isCompleted).toBe(false);
    // Weight-only edits keep completion.
    doneSet(setId, 100, 10);
    W.updateSet(setId, { weightKg: 105 });
    expect(W.getSessionDetail(sid)!.exercises[0].sets[0].isCompleted).toBe(true);
  });
});

describe('finding: finishing an empty workout', () => {
  beforeEach(() => createTestDb());
  it('rejects a workout with no exercises', () => {
    const sid = W.startWorkout();
    expect(() => W.finishSession(sid)).toThrow(/at least one set/);
    expect(W.getOpenSession()?.id).toBe(sid);
  });
  it('rejects a workout whose exercises have no sets', () => {
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_bench_press');
    W.deleteSet(W.getSessionDetail(sid)!.exercises[0].sets[0].id);
    expect(() => W.finishSession(sid)).toThrow(/at least one set/);
  });
});

describe('finding: history pagination ties', () => {
  beforeEach(() => createTestDb());
  it('does not skip sessions that share the boundary start time', () => {
    const t = Date.UTC(2026, 0, 1);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(workoutWith(50, 5, i < 3 ? t : t - (i + 1) * 3_600_000));
    const seen: string[] = [];
    let page = W.listHistory({ limit: 2 });
    while (page.length) {
      seen.push(...page.map((p) => p.id));
      const last = page[page.length - 1];
      page = W.listHistory({ limit: 2, after: { startedAt: last.startedAt, id: last.id } });
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });
});

describe('finding: merge restore with two open workouts', () => {
  it('keeps exactly one open workout and finishes the other', async () => {
    // Source device: an open workout with a completed set, started earlier.
    const source = createTestDb();
    const older = W.startWorkout({ nowMs: Date.UTC(2026, 0, 1, 10) });
    W.addExercise(older, 'ex_bench_press');
    doneSet(W.getSessionDetail(older)!.exercises[0].sets[0].id, 80, 8);
    const { bytes } = await createBackupArchive(source.db, memoryPhotoIO(), { includePhotos: false, schemaVersion: SCHEMA_VERSION, appVersion: 't' });

    // Target device: its own, newer open workout.
    const target = createTestDb();
    const newer = W.startWorkout({ nowMs: Date.UTC(2026, 0, 2, 10) });
    const result = await restoreBackup(target.db, memoryPhotoIO(), parseBackup(bytes, SCHEMA_VERSION), 'merge');

    expect(result.openSessionsResolved).toBe(1);
    const open = target.db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.status, 'active')).all();
    expect(open.map((s) => s.id)).toEqual([newer]);
    expect(W.getSessionDetail(older)!.session.status).toBe('completed');
    expect(W.listHistory({ limit: 10 }).map((h) => h.id)).toContain(older);
  });

  it('removes an extra open workout that has nothing completed', async () => {
    const source = createTestDb();
    const empty = W.startWorkout({ nowMs: Date.UTC(2026, 0, 1) });
    const { bytes } = await createBackupArchive(source.db, memoryPhotoIO(), { includePhotos: false, schemaVersion: SCHEMA_VERSION, appVersion: 't' });
    const target = createTestDb();
    W.startWorkout({ nowMs: Date.UTC(2026, 0, 2) });
    await restoreBackup(target.db, memoryPhotoIO(), parseBackup(bytes, SCHEMA_VERSION), 'merge');
    expect(W.getSessionDetail(empty)).toBeNull();
  });
});

describe('finding: replace restore is undoable for photos', () => {
  it('a safety backup taken with photos brings deleted photo files back', async () => {
    const { db } = createTestDb();
    db.insert(schema.progressPhotos).values({ id: 'p', fileName: 'p.jpg', takenAt: 1, category: 'front', createdAt: 1, updatedAt: 1 }).run();
    const photos = memoryPhotoIO({ 'p.jpg': new Uint8Array([7, 7]) });
    const opts = { schemaVersion: SCHEMA_VERSION, appVersion: 't' };
    // Same as restoreParsedBackup: safety backup WITH photos first.
    const safety = await createBackupArchive(db, photos, { ...opts, includePhotos: true });

    // Restore an older backup that has no photos -> replace deletes p.jpg.
    const other = createTestDb();
    const older = await createBackupArchive(other.db, memoryPhotoIO(), { ...opts, includePhotos: true });
    await restoreBackup(db, photos, parseBackup(older.bytes, SCHEMA_VERSION), 'replace');
    expect(photos.exists('p.jpg')).toBe(false);

    // Undo using the safety backup.
    await restoreBackup(db, photos, parseBackup(safety.bytes, SCHEMA_VERSION), 'replace');
    expect(photos.files.get('p.jpg')).toEqual(new Uint8Array([7, 7]));
  });
});

describe('finding: monthly report record counts', () => {
  it('counts records set in a past month even after they are beaten later', () => {
    createTestDb();
    const march = Date.UTC(2026, 2, 10, 12);
    const april = Date.UTC(2026, 3, 10, 12);
    workoutWith(100, 5, march);
    const marchCount = monthlyReport(march).recordsSet;
    expect(marchCount).toBe(5); // all five record types set for the first time
    workoutWith(120, 8, april); // beats every March record
    expect(monthlyReport(march).recordsSet).toBe(marchCount);
    expect(monthlyReport(april).recordsSet).toBe(5);
  });

  it('countRecordEvents counts each type once per session and only improvements', () => {
    const s = (id: string, sessionId: string, w: number, r: number, at: number) => ({ setId: id, sessionId, weightKg: w, reps: r, achievedAt: at });
    const sets = [s('a', 's1', 100, 5, 1), s('b', 's1', 100, 5, 2), s('c', 's2', 90, 5, 10), s('d', 's3', 110, 5, 20)];
    expect(countRecordEvents(sets, 0, 5)).toBe(5);
    expect(countRecordEvents(sets, 5, 15)).toBe(0); // s2 improved nothing
    // s3: max weight, e1RM, set volume. Not reps (unchanged) or session volume (550 < s1's 1000).
    expect(countRecordEvents(sets, 15, 25)).toBe(3);
  });
});
