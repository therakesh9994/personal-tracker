import { createTestDb } from '@/test/testDb';
import * as P from '../service';
import * as W from '@/features/workouts/service';

describe('plans', () => {
  beforeEach(() => createTestDb());

  it('creates, edits, duplicates and deletes plans', () => {
    const id = P.createPlan({ name: 'My plan' });
    const day = P.getPlanDetail(id)!.days[0];
    const pe = P.addPlanExercise(day.id, 'ex_bench_press');
    P.addPlanExercise(day.id, 'ex_ohp');
    P.updatePlanExercise(pe, { targetSets: 5, targetReps: 5, targetWeightKg: 80 });
    expect(() => P.updatePlanExercise(pe, { targetReps: 10, targetRepsMax: 8 })).toThrow(/Max reps/);
    P.movePlanExercise(pe, 1);
    let detail = P.getPlanDetail(id)!;
    expect(detail.days[0].exercises.map((e) => e.exerciseId)).toEqual(['ex_ohp', 'ex_bench_press']);
    expect(detail.days[0].exercises[1]).toMatchObject({ targetSets: 5, targetWeightKg: 80 });

    const copy = P.duplicatePlan(id);
    expect(P.getPlanDetail(copy)!.days[0].exercises).toHaveLength(2);

    P.deletePlan(id);
    expect(P.getPlanDetail(id)).toBeNull();
    expect(P.getPlanDetail(copy)).not.toBeNull();
    expect(() => P.createPlan({ name: '' })).toThrow(/empty/);
  });

  it('keeps workout history when a plan is deleted', () => {
    const sid = W.startWorkout({ planDayId: 'tpl_full_body_d0' });
    const set = W.getSessionDetail(sid)!.exercises[0].sets[0];
    W.updateSet(set.id, { weightKg: 60 });
    W.setCompleted(set.id, true);
    W.finishSession(sid);
    P.deletePlan('tpl_full_body');
    expect(W.getSessionDetail(sid)!.session.planId).toBeNull();
  });

  it('suggests today\'s plan by schedule or rotation', () => {
    const now = new Date(2026, 5, 3, 9).getTime(); // a Wednesday
    expect(P.getTodaysPlan(now)).toBeNull();
    const sid = W.startWorkout({ planDayId: 'tpl_ppl_d0', nowMs: now - 86_400_000 });
    const set = W.getSessionDetail(sid)!.exercises[0].sets[0];
    W.setCompleted(set.id, true);
    W.finishSession(sid, now - 80_000_000);
    expect(P.getTodaysPlan(now)).toMatchObject({ day: { name: 'Pull' }, reason: 'next_in_rotation' });
    P.updateDay('tpl_upper_lower_d1', { dayOfWeek: new Date(now).getDay() });
    expect(P.getTodaysPlan(now)).toMatchObject({ day: { name: 'Lower A' }, reason: 'scheduled' });
  });
});
