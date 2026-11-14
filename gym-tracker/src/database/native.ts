/**
 * Native database bootstrap (expo-sqlite). Not imported by Node tests.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import migrations from './migrations/migrations';
import * as schema from './schema';
import { setDb } from './client';
import type { AppDb } from './types';
import { seedReferenceData } from './seed';

export const DATABASE_NAME = 'gym-tracker.db';

let sqlite: SQLiteDatabase | null = null;

export function getSqlite(): SQLiteDatabase {
  if (!sqlite) {
    sqlite = openDatabaseSync(DATABASE_NAME);
    // Foreign keys are off by default in SQLite and must be enabled per connection.
    sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  return sqlite;
}

/**
 * Opens the database, applies pending migrations (each run inside a transaction
 * by Drizzle, so a failure leaves the previous schema intact), and seeds
 * reference data (exercise library, plan templates, default settings).
 */
export async function initDatabase(): Promise<AppDb> {
  const client = getSqlite();
  const db = drizzle(client, { schema }) as unknown as AppDb;
  await migrate(db as never, migrations);
  seedReferenceData(db);
  setDb(db);
  return db;
}
