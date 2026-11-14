import { startOfDay, subDays } from 'date-fns';
import { getDb } from '@/database/client';
import * as workoutRepo from '@/features/workouts/repository';
import { workoutStreak } from '@/features/workouts/calculations';
import { dailyBuckets, fillBuckets, sessionStats, type Bucket } from '@/features/analytics/service';
import { getDayNutrition, getDayWater } from '@/features/nutrition/service';
import { getGoalsForDay } from '@/features/settings/service';
import { weightTrend } from '@/features/measurements/service';
import { getTodaysPlan, type TodaysPlan } from '@/features/plans/service';
import type { MacroTotals } from '@/features/nutrition/calculations';
import type { DailyGoal, WorkoutSession } from '@/database/schema';
import { weekStart } from '@/utils/time';

export interface DashboardData {
  totalWorkouts: number;
  weekWorkouts: number;
  streak: number;
  openSession: WorkoutSession | null;
  todaysPlan: TodaysPlan | null;
  recent: workoutRepo.HistoryItem[];
  last7Days: Bucket[];
  nutrition: MacroTotals;
  waterMl: number;
  goals: DailyGoal | null;
  weight: { latest: number; previous: number | null; measuredAt: number } | null;
}

export function loadDashboard(nowMs = Date.now()): DashboardData {
  const db = getDb();
  const today = startOfDay(nowMs).getTime();
  const sevenDaysAgo = startOfDay(subDays(nowMs, 6)).getTime();
  const starts = workoutRepo.completedSessionStarts(db, startOfDay(subDays(nowMs, 400)).getTime());
  const dayStarts = [...new Set(starts.map((s) => startOfDay(s).getTime()))];
  const stats = sessionStats(sevenDaysAgo);
  const next = (ms: number) => {
    const d = new Date(ms);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  };
  return {
    totalWorkouts: workoutRepo.countCompletedSessions(db),
    weekWorkouts: workoutRepo.countCompletedSessions(db, weekStart(nowMs)),
    streak: workoutStreak(dayStarts, today),
    openSession: workoutRepo.findOpenSession(db) ?? null,
    todaysPlan: getTodaysPlan(nowMs),
    recent: workoutRepo.listHistory(db, { limit: 3 }),
    last7Days: fillBuckets(dailyBuckets(stats), sevenDaysAgo, today, next),
    nutrition: getDayNutrition(nowMs).totals,
    waterMl: getDayWater(nowMs).totalMl,
    goals: getGoalsForDay(nowMs),
    weight: weightTrend(),
  };
}
