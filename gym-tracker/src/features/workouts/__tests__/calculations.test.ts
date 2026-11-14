import { estimateOneRepMax, sessionDurationMs, sessionVolume, summarizeSession, workoutStreak } from '../calculations';

const set = (w: number | null, r: number | null, done = true, type: any = 'working') => ({ weightKg: w, reps: r, isCompleted: done, setType: type });

describe('workout calculations', () => {
  it('computes volume from completed non-warm-up sets only', () => {
    expect(sessionVolume([set(100, 5), set(60, 10, true, 'warmup'), set(100, 5, false), set(80, 8, true, 'drop')])).toBe(500 + 640);
  });
  it('treats missing weight as zero volume', () => {
    expect(sessionVolume([set(null, 12)])).toBe(0);
  });
  it('uses the Epley formula', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });
  it('excludes paused time from duration', () => {
    expect(sessionDurationMs({ startedAt: 0, endedAt: 3_600_000, pausedAt: null, totalPausedMs: 600_000 })).toBe(3_000_000);
    expect(sessionDurationMs({ startedAt: 0, endedAt: null, pausedAt: 1_000, totalPausedMs: 0 }, 5_000)).toBe(1_000);
  });
  it('summarises a session', () => {
    const s = summarizeSession([
      { primaryMuscle: 'chest', sets: [set(100, 5), set(100, 5), set(40, 10, true, 'warmup')] },
      { primaryMuscle: 'back', sets: [set(50, 10, false)] },
    ]);
    expect(s).toEqual({ completedSets: 3, totalReps: 10, totalVolumeKg: 1000, exerciseCount: 2, muscleDistribution: { chest: 2 } });
  });
  it('counts streaks of consecutive days', () => {
    const d = (n: number) => new Date(2026, 0, n).getTime();
    expect(workoutStreak([d(1), d(2), d(3)], d(3))).toBe(3);
    expect(workoutStreak([d(1), d(2), d(3)], d(4))).toBe(3); // today not trained yet
    expect(workoutStreak([d(1), d(3)], d(5))).toBe(0);
  });
});
