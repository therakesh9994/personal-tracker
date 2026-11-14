import { getTableColumns, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/database/schema';
import type { AppDb } from '@/database/types';
import { recalculateRecords } from '@/features/personal-records/service';
import { resolveDuplicateOpenSessions } from '@/features/workouts/service';
import { BACKUP_TABLES, type BackupTable, type BackupTables, type Row } from './format';

export const TABLE_OBJECTS: Record<BackupTable, SQLiteTable> = {
  user_profile: schema.userProfile,
  app_settings: schema.appSettings,
  daily_goals: schema.dailyGoals,
  exercises: schema.exercises,
  workout_plans: schema.workoutPlans,
  plan_days: schema.planDays,
  plan_exercises: schema.planExercises,
  workout_sessions: schema.workoutSessions,
  workout_exercises: schema.workoutExercises,
  workout_sets: schema.workoutSets,
  workout_notes: schema.workoutNotes,
  body_measurements: schema.bodyMeasurements,
  progress_photos: schema.progressPhotos,
  personal_records: schema.personalRecords,
  foods: schema.foods,
  nutrition_entries: schema.nutritionEntries,
  water_logs: schema.waterLogs,
};

export function dumpTables(db: AppDb): BackupTables {
  const out = {} as BackupTables;
  for (const t of BACKUP_TABLES) {
    out[t] = db.select().from(TABLE_OBJECTS[t]).all() as Row[];
  }
  return out;
}

/** Keep only known columns so a hand-edited or foreign file cannot inject unexpected fields. */
function sanitize(table: SQLiteTable, rows: Row[]): Record<string, unknown>[] {
  const cols = Object.keys(getTableColumns(table));
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of cols) if (c in r) o[c] = r[c];
    return o;
  });
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreSummary {
  inserted: number;
  skippedDuplicates: number;
  /** Extra in-progress workouts that were finished/removed to keep a single open workout. */
  openSessionsResolved: number;
}

/**
 * Restore tables in a single transaction with foreign keys enforced. Any
 * constraint violation rolls back everything, leaving the current data intact.
 * - replace: wipe all user tables, then insert the backup.
 * - merge:   insert records whose IDs are not present; existing records win.
 */
export function restoreTables(db: AppDb, tables: BackupTables, mode: RestoreMode): RestoreSummary {
  return db.transaction((tx) => {
    if (mode === 'replace') {
      for (const t of [...BACKUP_TABLES].reverse()) tx.delete(TABLE_OBJECTS[t]).run();
    }
    let inserted = 0;
    let skipped = 0;
    for (const t of BACKUP_TABLES) {
      const table = TABLE_OBJECTS[t];
      const rows = sanitize(table, tables[t] ?? []);
      const before = countRows(tx, table);
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        if (mode === 'merge') {
          tx.insert(table).values(chunk as never).onConflictDoNothing().run();
        } else {
          tx.insert(table).values(chunk as never).run();
        }
      }
      const added = countRows(tx, table) - before;
      inserted += added;
      skipped += rows.length - added;
    }
    const fkProblems = tx.all(sql`PRAGMA foreign_key_check`);
    if (fkProblems.length > 0) throw new Error('FOREIGN KEY integrity check failed during restore.');
    // A merge (or a hand-edited file) can bring a second in-progress workout; keep only one open.
    const openSessionsResolved = resolveDuplicateOpenSessions(tx);
    if (mode === 'merge') {
      // Merged history can change records: recompute for every trained exercise.
      const ids = tx.selectDistinct({ id: schema.workoutExercises.exerciseId }).from(schema.workoutExercises).all();
      recalculateRecords(
        tx,
        ids.map((r) => r.id),
      );
    }
    return { inserted, skippedDuplicates: skipped, openSessionsResolved };
  });
}

function countRows(db: AppDb, table: SQLiteTable): number {
  const r = db.select({ n: sql<number>`count(*)` }).from(table).get() as { n: number } | undefined;
  return Number(r?.n ?? 0);
}
