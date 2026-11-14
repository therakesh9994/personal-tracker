import type { AppDb } from './types';
import journal from './migrations/meta/_journal.json';

let current: AppDb | null = null;

/** Schema version = number of applied Drizzle migrations shipped with this build. */
export const SCHEMA_VERSION: number = journal.entries.length;

export function setDb(db: AppDb | null): void {
  current = db;
}

export function getDb(): AppDb {
  if (!current) {
    throw new Error('Database has not been initialised yet.');
  }
  return current;
}

export function hasDb(): boolean {
  return current !== null;
}
