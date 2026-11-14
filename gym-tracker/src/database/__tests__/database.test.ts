import { eq, sql } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createTestDb, MIGRATIONS_FOLDER } from '@/test/testDb';
import * as schema from '@/database/schema';
import { seedReferenceData } from '@/database/seed';
import { EXERCISE_LIBRARY } from '@/constants/exerciseLibrary';
import { PLAN_TEMPLATES } from '@/constants/planTemplates';
import { SCHEMA_VERSION } from '@/database/client';

describe('database initialisation', () => {
  it('creates all required tables', () => {
    const { sqlite } = createTestDb({ seed: false });
    const tables = sqlite
      .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%'")
      .all()
      .map((r: any) => r.name)
      .sort();
    expect(tables).toEqual(
      [
        'app_settings', 'backup_metadata', 'body_measurements', 'daily_goals', 'exercises', 'foods',
        'nutrition_entries', 'personal_records', 'plan_days', 'plan_exercises', 'progress_photos',
        'user_profile', 'water_logs', 'workout_exercises', 'workout_notes', 'workout_plans',
        'workout_sessions', 'workout_sets',
      ].sort(),
    );
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('seeds the exercise library and templates idempotently', () => {
    const { db } = createTestDb();
    seedReferenceData(db); // second run must not duplicate or fail
    const count = db.select({ n: sql<number>`count(*)` }).from(schema.exercises).get()!.n;
    expect(count).toBe(EXERCISE_LIBRARY.length);
    const plans = db.select().from(schema.workoutPlans).all();
    expect(plans).toHaveLength(PLAN_TEMPLATES.length);
  });

  it('does not resurrect a deleted template on next launch', () => {
    const { db } = createTestDb();
    db.delete(schema.workoutPlans).where(eq(schema.workoutPlans.id, 'tpl_ppl')).run();
    seedReferenceData(db);
    expect(db.select().from(schema.workoutPlans).where(eq(schema.workoutPlans.id, 'tpl_ppl')).get()).toBeUndefined();
    // cascade removed its days
    expect(db.select().from(schema.planDays).where(eq(schema.planDays.planId, 'tpl_ppl')).all()).toHaveLength(0);
  });

  it('seed references only existing exercises', () => {
    const ids = new Set(EXERCISE_LIBRARY.map((e) => e.id));
    for (const tpl of PLAN_TEMPLATES) for (const d of tpl.days) for (const e of d.exercises) expect(ids.has(e.exerciseId)).toBe(true);
    expect(ids.size).toBe(EXERCISE_LIBRARY.length); // no duplicate IDs
  });
});

describe('foreign keys', () => {
  it('rejects orphan rows', () => {
    const { db } = createTestDb();
    expect(() =>
      db.insert(schema.workoutExercises).values({
        id: 'x', sessionId: 'missing', exerciseId: 'ex_bench_press', exerciseName: 'Bench', primaryMuscle: 'chest',
        position: 0, createdAt: 1, updatedAt: 1,
      }).run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('restricts deleting an exercise that is used in history', () => {
    const { db } = createTestDb();
    db.insert(schema.workoutSessions).values({ id: 's', name: 'S', status: 'completed', startedAt: 1, createdAt: 1, updatedAt: 1 }).run();
    db.insert(schema.workoutExercises).values({ id: 'we', sessionId: 's', exerciseId: 'ex_bench_press', exerciseName: 'Bench', primaryMuscle: 'chest', position: 0, createdAt: 1, updatedAt: 1 }).run();
    expect(() => db.delete(schema.exercises).where(eq(schema.exercises.id, 'ex_bench_press')).run()).toThrow(/FOREIGN KEY/);
  });

  it('cascades session deletion to exercises and sets', () => {
    const { db } = createTestDb();
    db.insert(schema.workoutSessions).values({ id: 's', name: 'S', status: 'completed', startedAt: 1, createdAt: 1, updatedAt: 1 }).run();
    db.insert(schema.workoutExercises).values({ id: 'we', sessionId: 's', exerciseId: 'ex_bench_press', exerciseName: 'Bench', primaryMuscle: 'chest', position: 0, createdAt: 1, updatedAt: 1 }).run();
    db.insert(schema.workoutSets).values({ id: 'set', workoutExerciseId: 'we', setNumber: 1, createdAt: 1, updatedAt: 1 }).run();
    db.delete(schema.workoutSessions).where(eq(schema.workoutSessions.id, 's')).run();
    expect(db.select().from(schema.workoutSets).all()).toHaveLength(0);
  });
});

describe('transactions', () => {
  it('rolls back all writes when one fails', () => {
    const { db } = createTestDb();
    expect(() =>
      db.transaction((tx) => {
        tx.insert(schema.waterLogs).values({ id: 'w1', amountMl: 250, loggedAt: 1, createdAt: 1, updatedAt: 1 }).run();
        tx.insert(schema.waterLogs).values({ id: 'w1', amountMl: 250, loggedAt: 1, createdAt: 1, updatedAt: 1 }).run();
      }),
    ).toThrow();
    expect(db.select().from(schema.waterLogs).all()).toHaveLength(0);
  });
});

describe('migrations', () => {
  it('re-running migrations on an existing database preserves data', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    db.insert(schema.waterLogs).values({ id: 'keep', amountMl: 500, loggedAt: 1, createdAt: 1, updatedAt: 1 }).run();
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    expect(db.select().from(schema.waterLogs).all()).toHaveLength(1);
    const applied = sqlite.prepare('select count(*) n from __drizzle_migrations').get() as { n: number };
    expect(applied.n).toBe(SCHEMA_VERSION);
  });
});
