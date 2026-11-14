import type { MuscleGroup, SetType } from '@/database/schema';

export interface SetLike {
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  isCompleted: boolean;
}

/** Sets that count toward volume and records: completed, non-warm-up. */
export function isCountedSet(s: SetLike): boolean {
  return s.isCompleted && s.setType !== 'warmup';
}

/** Volume = Weight × Repetitions. Bodyweight sets with no weight contribute 0. */
export function setVolume(s: Pick<SetLike, 'weightKg' | 'reps'>): number {
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

/** Total session volume: sum of completed working (non-warm-up) set volumes. */
export function sessionVolume(sets: SetLike[]): number {
  return sets.filter(isCountedSet).reduce((sum, s) => sum + setVolume(s), 0);
}

/** Epley: 1RM = w × (1 + reps/30). For a single rep the lift itself is the 1RM. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface SessionTiming {
  startedAt: number;
  endedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
}

/** Active training time, excluding paused periods. */
export function sessionDurationMs(s: SessionTiming, nowMs: number = Date.now()): number {
  const end = s.endedAt ?? nowMs;
  const currentPause = s.pausedAt != null ? Math.max(0, end - s.pausedAt) : 0;
  return Math.max(0, end - s.startedAt - s.totalPausedMs - currentPause);
}

export interface ExerciseWithSets {
  primaryMuscle: MuscleGroup;
  sets: SetLike[];
}

export interface SessionSummary {
  completedSets: number;
  totalReps: number;
  totalVolumeKg: number;
  exerciseCount: number;
  muscleDistribution: Partial<Record<MuscleGroup, number>>;
}

export function summarizeSession(exercises: ExerciseWithSets[]): SessionSummary {
  const summary: SessionSummary = {
    completedSets: 0,
    totalReps: 0,
    totalVolumeKg: 0,
    exerciseCount: exercises.length,
    muscleDistribution: {},
  };
  for (const ex of exercises) {
    const counted = ex.sets.filter(isCountedSet);
    summary.completedSets += ex.sets.filter((s) => s.isCompleted).length;
    summary.totalReps += counted.reduce((n, s) => n + (s.reps ?? 0), 0);
    summary.totalVolumeKg += sessionVolume(ex.sets);
    if (counted.length > 0) {
      summary.muscleDistribution[ex.primaryMuscle] =
        (summary.muscleDistribution[ex.primaryMuscle] ?? 0) + counted.length;
    }
  }
  return summary;
}

/** Number of consecutive days (ending today or yesterday) with at least one workout. */
export function workoutStreak(dayStarts: number[], todayStart: number): number {
  const days = new Set(dayStarts);
  // Calendar arithmetic (not fixed 24h steps) so DST changes don't break the chain.
  const previousDay = (ms: number) => {
    const d = new Date(ms);
    d.setDate(d.getDate() - 1);
    return d.getTime();
  };
  // Keep the streak alive if today has no workout yet.
  let cursor = days.has(todayStart) ? todayStart : previousDay(todayStart);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}
