import { createTestDb } from '@/test/testDb';
import * as W from '@/features/workouts/service';
import { exerciseProgress, muscleDistribution, sessionStats } from '../service';
import { loadDashboard } from '@/features/dashboard/service';
import { recalculateRecords } from '@/features/personal-records/service';
import { getDb } from '@/database/client';

/** Seeds 10,000 completed sessions × 10 sets (100,000 sets) with raw SQL for speed. */
function seedLarge(sqlite: import('better-sqlite3').Database) {
  const exercises = ['ex_bench_press', 'ex_back_squat', 'ex_deadlift', 'ex_ohp', 'ex_barbell_row'];
  const insS = sqlite.prepare("insert into workout_sessions (id,name,status,started_at,ended_at,total_paused_ms,created_at,updated_at) values (?,?, 'completed', ?, ?, 0, ?, ?)");
  const insE = sqlite.prepare("insert into workout_exercises (id,session_id,exercise_id,exercise_name,primary_muscle,position,created_at,updated_at) values (?,?,?,?, 'chest', ?, 1, 1)");
  const insSet = sqlite.prepare("insert into workout_sets (id,workout_exercise_id,set_number,set_type,weight_kg,reps,is_completed,completed_at,created_at,updated_at) values (?,?,?, 'working', ?, ?, 1, ?, 1, 1)");
  const start = Date.UTC(2000, 0, 1);
  sqlite.transaction(() => {
    for (let i = 0; i < 10_000; i++) {
      const t = start + i * 86_400_000;
      insS.run(`s${i}`, `Session ${i}`, t, t + 3_600_000, t, t);
      for (let e = 0; e < 2; e++) {
        const weId = `we${i}_${e}`;
        insE.run(weId, `s${i}`, exercises[(i + e) % 5], 'X', e);
        for (let k = 1; k <= 5; k++) insSet.run(`set${i}_${e}_${k}`, weId, k, 60 + (i % 50), 5 + (k % 4), t);
      }
    }
  })();
}

describe('performance with a large history', () => {
  it('stays responsive with 10,000 sessions and 100,000 sets', () => {
    const { sqlite } = createTestDb();
    seedLarge(sqlite);
    const time = (fn: () => unknown) => {
      const t0 = performance.now();
      fn();
      return performance.now() - t0;
    };
    const timings = {
      historyFirstPage: time(() => W.listHistory({ limit: 30 })),
      historyDeepPage: time(() => W.listHistory({ limit: 30, after: { startedAt: Date.UTC(2010, 0, 1), id: '~' } })),
      dashboard: time(() => loadDashboard()),
      stats90d: time(() => sessionStats(Date.now() - 90 * 86_400_000)),
      statsAllTime: time(() => sessionStats(0)),
      muscles: time(() => muscleDistribution(0)),
      exerciseProgress: time(() => exerciseProgress('ex_bench_press', 0)),
      recalcRecords: time(() => recalculateRecords(getDb(), ['ex_bench_press'])),
      previousPerformance: time(() => W.getPreviousPerformance('ex_bench_press')),
    };
    console.log('timings (ms)', Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)])));
    expect(W.listHistory({ limit: 30 })).toHaveLength(30);
    // Interactive queries must be fast; all-time aggregates are allowed more time.
    expect(timings.historyFirstPage).toBeLessThan(100);
    expect(timings.previousPerformance).toBeLessThan(50);
    expect(timings.dashboard).toBeLessThan(250);
    expect(timings.statsAllTime).toBeLessThan(1500);
  });
});
