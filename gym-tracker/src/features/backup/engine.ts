/**
 * Backup/restore orchestration with injected file IO, so the full flow
 * (including photo files) can be tested in Node and run on device unchanged.
 */
import type { AppDb } from '@/database/types';
import { ensureSingletons, seedExercises } from '@/database/seed';
import { buildArchive, buildJsonExport, parseBackup, type BackupManifest, type ParsedBackup } from './format';
import { dumpTables, restoreTables, type RestoreMode, type RestoreSummary } from './repository';

export interface PhotoIO {
  /** Returns file bytes, or null if the file is missing/unreadable. */
  read(fileName: string): Promise<Uint8Array | null>;
  write(fileName: string, bytes: Uint8Array): Promise<void>;
  exists(fileName: string): boolean;
  remove(fileName: string): void;
  list(): string[];
}

export interface CreateBackupOptions {
  includePhotos: boolean;
  schemaVersion: number;
  appVersion: string;
  nowMs?: number;
}

export async function createBackupArchive(db: AppDb, photos: PhotoIO, opts: CreateBackupOptions): Promise<{ bytes: Uint8Array; manifest: BackupManifest }> {
  const tables = dumpTables(db);
  let photoMap: Map<string, Uint8Array | null> | undefined;
  if (opts.includePhotos) {
    photoMap = new Map();
    for (const row of tables.progress_photos) {
      const name = String(row.fileName);
      // Missing files are reported in the manifest instead of failing the backup.
      photoMap.set(name, await photos.read(name));
    }
  }
  return buildArchive({ tables, schemaVersion: opts.schemaVersion, appVersion: opts.appVersion, createdAt: opts.nowMs ?? Date.now(), photos: photoMap });
}

export function createJsonExport(db: AppDb, opts: Omit<CreateBackupOptions, 'includePhotos'>): string {
  return buildJsonExport({ tables: dumpTables(db), schemaVersion: opts.schemaVersion, appVersion: opts.appVersion, createdAt: opts.nowMs ?? Date.now() });
}

export function inspectBackup(bytes: Uint8Array, schemaVersion: number): ParsedBackup {
  return parseBackup(bytes, schemaVersion);
}

export interface RestoreResult extends RestoreSummary {
  photosRestored: number;
  photosMissing: number;
}

/**
 * Restore a validated backup.
 * 1. Write photo files that don't exist yet (UUID names never collide).
 * 2. Restore the database in one transaction (rolls back fully on any error).
 * 3. On DB failure, remove the photo files written in step 1.
 * 4. In replace mode, delete photo files no longer referenced.
 */
export async function restoreBackup(db: AppDb, photos: PhotoIO, parsed: ParsedBackup, mode: RestoreMode): Promise<RestoreResult> {
  const written: string[] = [];
  try {
    for (const [name, bytes] of parsed.photos) {
      if (!photos.exists(name)) {
        await photos.write(name, bytes);
        written.push(name);
      }
    }
  } catch (e) {
    for (const n of written) photos.remove(n);
    throw e;
  }

  let summary: RestoreSummary;
  try {
    summary = restoreTables(db, parsed.tables, mode);
    // A restored file might lack settings rows or newer built-in exercises.
    db.transaction((tx) => {
      seedExercises(tx);
      ensureSingletons(tx);
    });
  } catch (e) {
    for (const n of written) photos.remove(n);
    throw e;
  }

  const referenced = new Set(dumpTables(db).progress_photos.map((p) => String(p.fileName)));
  if (mode === 'replace') {
    for (const f of photos.list()) if (!referenced.has(f)) photos.remove(f);
  }
  let missing = 0;
  for (const f of referenced) if (!photos.exists(f)) missing++;
  return { ...summary, photosRestored: written.length, photosMissing: missing };
}
