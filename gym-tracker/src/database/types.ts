import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/**
 * Synchronous Drizzle database. Both the expo-sqlite driver (app) and the
 * better-sqlite3 driver (tests) satisfy this type, so repositories and services
 * can be exercised against a real SQLite engine in Node.
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
