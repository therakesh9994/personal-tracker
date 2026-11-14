import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from '@/database/schema';
import { setDb } from '@/database/client';
import { seedReferenceData } from '@/database/seed';
import type { AppDb } from '@/database/types';

export const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'database', 'migrations');

/** Fresh in-memory SQLite database with the real migrations applied (same SQL as the app). */
export function createTestDb(options: { seed?: boolean } = {}): { db: AppDb; sqlite: Database.Database } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema }) as unknown as AppDb;
  migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  if (options.seed !== false) seedReferenceData(db);
  setDb(db);
  return { db, sqlite };
}
