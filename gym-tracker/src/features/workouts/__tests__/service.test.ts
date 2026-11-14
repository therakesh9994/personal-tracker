import { eq } from 'drizzle-orm';
import { createTestDb } from '@/test/testDb';
import * as schema from '@/database/schema';
import * as W from '../service';
import { listAllRecords } from '@/features/personal-records/service';

function completeSet(setId: string, weightKg: number, reps: number, setType: schema.SetType = 'working') {
  W.updateSet(setId, { weightKg, reps, setType });
  W.setCompleted(setId, true);
}

describe('workout service', () => {
  beforeEach(() => createTestDb());

  it('starts an empty workout and prevents a second concurrent one', () => {
    const id = W.startWorkout({ name: 'Leg day' });
    expect(W.getOpenSession()?.id).toBe(id);
    expect(() => W.startWorkout()).toThrow(W.ActiveWorkoutExistsError);
  });

  it('rejects an empty workout name', () => {
    expect(() => W.startWorkout({ name: '   ' })).not.toThrow(); // falls back to default name
    const id = W.getOpenSession()!.id;
    expect(() => W.renameSession(id, '  ')).toThrow(/empty/);
  });

  it('adds exercises, records sets and finishes with correct volume', () => {
    const sid = W.startWorkout({ name: 'Push' });
    const we = W.addExercise(sid, 'ex_bench_press');
    const first = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
    completeSet(first, 100, 5);
    const second = W.addSet(we);
    let detail = W.getSessionDetail(sid)!;
    expect(detail.exercises[0].sets[1]).toMatchObject({ weightKg: 100, reps: 5, setNumber: 2, isCompleted: false });
    W.setCompleted(second, true);
    W.addSet(we); // left incomplete -> discarded at finish
    const res = W.finishSession(sid);
    expect(res).toMatchObject({ alreadyFinished: false, discardedSets: 1 });
    detail = W.getSessionDetail(sid)!;
    expect(detail.session.status).toBe('completed');
    expect(detail.exercises[0].sets).toHaveLength(2);
    const [h] = W.listHistory({ limit: 10 });
    expect(h).toMatchObject({ id: sid, completedSets: 2, volumeKg: 1000, exerciseCount: 1 });
  });

  it('finishing twice is idempotent', () => {
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_back_squat');
    completeSet(W.getSessionDetail(sid)!.exercises[0].sets[0].id, 120, 3);
    W.finishSession(sid);
    expect(W.finishSession(sid).alreadyFinished).toBe(true);
  });

  it('validates weights and reps', () => {
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_bench_press');
    const setId = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
    expect(() => W.updateSet(setId, { weightKg: -5 })).toThrow(/negative/);
    expect(() => W.updateSet(setId, { reps: 2.5 })).toThrow(/whole/);
    expect(() => W.updateSet(setId, { rpe: 11 })).toThrow(/RPE/);
    expect(() => W.setCompleted(setId, true)).toThrow(/reps/);
  });

  it('recovers an unfinished workout (state lives in SQLite)', () => {
    const { db } = createTestDb();
    const sid = W.startWorkout({ name: 'Recover me' });
    W.addExercise(sid, 'ex_bench_press');
    W.pauseSession(sid, Date.now());
    // Simulate restart: a fresh read from the same database.
    const open = db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.status, 'paused')).get();
    expect(open?.id).toBe(sid);
    expect(W.getOpenSession()?.id).toBe(sid);
    expect(W.getSessionDetail(sid)!.exercises).toHaveLength(1);
  });

  it('tracks paused time', () => {
    const sid = W.startWorkout({ nowMs: 0 });
    W.pauseSession(sid, 1_000);
    W.resumeSession(sid, 61_000);
    expect(W.getSessionDetail(sid)!.session.totalPausedMs).toBe(60_000);
  });

  it('starts from a plan day without modifying the plan', () => {
    const { db } = createTestDb();
    const before = db.select().from(schema.planExercises).where(eq(schema.planExercises.planDayId, 'tpl_ppl_d0')).all();
    const sid = W.startWorkout({ planDayId: 'tpl_ppl_d0' });
    const detail = W.getSessionDetail(sid)!;
    expect(detail.session.name).toBe('Push');
    expect(detail.exercises.map((e) => e.exerciseId)).toEqual(before.map((p) => p.exerciseId));
    expect(detail.exercises[0].sets).toHaveLength(before[0].targetSets);
    completeSet(detail.exercises[0].sets[0].id, 80, 8);
    W.finishSession(sid);
    const after = db.select().from(schema.planExercises).where(eq(schema.planExercises.planDayId, 'tpl_ppl_d0')).all();
    expect(after).toEqual(before);
  });

  it('starts from a previous workout copying completed sets', () => {
    const sid = W.startWorkout({ name: 'Original' });
    W.addExercise(sid, 'ex_bench_press');
    completeSet(W.getSessionDetail(sid)!.exercises[0].sets[0].id, 90, 6);
    W.finishSession(sid);
    const copy = W.startWorkout({ sourceSessionId: sid });
    const d = W.getSessionDetail(copy)!;
    expect(d.session.name).toBe('Original');
    expect(d.exercises[0].sets[0]).toMatchObject({ weightKg: 90, reps: 6, isCompleted: false });
  });

  it('reorders and removes exercises', () => {
    const sid = W.startWorkout();
    const a = W.addExercise(sid, 'ex_bench_press');
    const b = W.addExercise(sid, 'ex_ohp');
    const c = W.addExercise(sid, 'ex_lateral_raise');
    W.moveExercise(c, -1);
    expect(W.getSessionDetail(sid)!.exercises.map((e) => e.id)).toEqual([a, c, b]);
    W.removeExercise(a);
    const ex = W.getSessionDetail(sid)!.exercises;
    expect(ex.map((e) => [e.id, e.position])).toEqual([[c, 0], [b, 1]]);
  });

  it('renumbers sets after deletion', () => {
    const sid = W.startWorkout();
    const we = W.addExercise(sid, 'ex_bench_press');
    W.addSet(we);
    W.addSet(we);
    const sets = W.getSessionDetail(sid)!.exercises[0].sets;
    W.deleteSet(sets[0].id);
    expect(W.getSessionDetail(sid)!.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('suggests previous performance when adding an exercise', () => {
    const s1 = W.startWorkout();
    W.addExercise(s1, 'ex_bench_press');
    completeSet(W.getSessionDetail(s1)!.exercises[0].sets[0].id, 102.5, 4);
    W.finishSession(s1);
    const s2 = W.startWorkout();
    W.addExercise(s2, 'ex_bench_press');
    expect(W.getSessionDetail(s2)!.exercises[0].sets[0]).toMatchObject({ weightKg: 102.5, reps: 4 });
    expect(W.getPreviousPerformance('ex_bench_press', s2)?.sessionId).toBe(s1);
  });

  it('cancel removes the in-progress workout', () => {
    const sid = W.startWorkout();
    W.cancelSession(sid);
    expect(W.getOpenSession()).toBeNull();
  });

  it('saves and clears notes', () => {
    const sid = W.startWorkout();
    W.saveNote(sid, 'Felt strong');
    W.saveNote(sid, 'Felt strong!!');
    expect(W.getSessionDetail(sid)!.sessionNote?.content).toBe('Felt strong!!');
    W.saveNote(sid, '');
    expect(W.getSessionDetail(sid)!.sessionNote).toBeNull();
  });

  it('keeps history valid when an exercise is renamed', () => {
    const { db } = createTestDb();
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_bench_press');
    completeSet(W.getSessionDetail(sid)!.exercises[0].sets[0].id, 60, 10);
    W.finishSession(sid);
    db.update(schema.exercises).set({ name: 'Renamed' }).where(eq(schema.exercises.id, 'ex_bench_press')).run();
    expect(W.getSessionDetail(sid)!.exercises[0].exerciseName).toBe('Barbell Bench Press');
  });
});

describe('personal records', () => {
  beforeEach(() => createTestDb());

  it('detects records, ignores warm-ups, and recalculates on edit/delete', () => {
    const sid = W.startWorkout();
    const we = W.addExercise(sid, 'ex_bench_press');
    const s1 = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
    completeSet(s1, 200, 1, 'warmup'); // must not count
    const s2 = W.addSet(we, { duplicatePrevious: false });
    completeSet(s2, 100, 5);
    const s3 = W.addSet(we, { duplicatePrevious: false });
    completeSet(s3, 80, 12);
    const res = W.finishSession(sid);
    expect(res.newRecordCount).toBe(5);

    const byType = Object.fromEntries(listAllRecords().map((r) => [r.recordType, r]));
    expect(byType.max_weight).toMatchObject({ value: 100, workoutSetId: s2, isEstimate: false });
    expect(byType.max_reps).toMatchObject({ value: 12, workoutSetId: s3 });
    expect(byType.estimated_1rm).toMatchObject({ workoutSetId: s2 }); // 100×(1+5/30)=116.7 beats 80×(1+12/30)=112
    expect(byType.estimated_1rm.value).toBeCloseTo(100 * (1 + 5 / 30));
    expect(byType.estimated_1rm.isEstimate).toBe(true);
    expect(byType.max_set_volume).toMatchObject({ value: 960, workoutSetId: s3 });
    expect(byType.best_session_volume.value).toBe(500 + 960);

    // Edit the historical set -> records recalculate.
    W.updateSet(s2, { weightKg: 150 });
    expect(listAllRecords().find((r) => r.recordType === 'max_weight')!.value).toBe(150);
    // Delete -> falls back to remaining set.
    W.deleteSet(s2);
    expect(listAllRecords().find((r) => r.recordType === 'max_weight')!.value).toBe(80);
    // Delete the whole workout -> no records left.
    W.deleteSession(sid);
    expect(listAllRecords()).toHaveLength(0);
  });

  it('does not count in-progress sessions', () => {
    const sid = W.startWorkout();
    W.addExercise(sid, 'ex_bench_press');
    completeSet(W.getSessionDetail(sid)!.exercises[0].sets[0].id, 100, 5);
    expect(listAllRecords()).toHaveLength(0);
  });
});
