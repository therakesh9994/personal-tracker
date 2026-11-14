import { createTestDb } from '@/test/testDb';
import * as W from '@/features/workouts/service';
import { recordSummary } from '../service';
import { formatInt } from '@/utils/units';

function workout(weightKg: number, reps: number, nowMs: number) {
  const sid = W.startWorkout({ nowMs });
  W.addExercise(sid, 'ex_bench_press', nowMs);
  const setId = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
  W.updateSet(setId, { weightKg, reps });
  W.setCompleted(setId, true, nowMs);
  W.finishSession(sid, nowMs + 1000);
}

describe('recordSummary', () => {
  beforeEach(() => createTestDb());
  it('counts records set in the month of the given time and the total tracked', () => {
    const march = new Date(2026, 2, 10, 12).getTime();
    workout(100, 5, march);
    expect(recordSummary(march)).toEqual({ thisMonth: 5, total: 5 });
    expect(recordSummary(new Date(2026, 3, 2).getTime())).toEqual({ thisMonth: 0, total: 5 });
  });
});

describe('formatInt', () => {
  it('adds thousands separators and rounds', () => {
    expect(formatInt(1240.4)).toBe('1,240');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(-12345.6)).toBe('-12,346');
    expect(formatInt(1000000)).toBe('1,000,000');
  });
});
