/**
 * Device-side backup service: files in private storage, rotation, export/share,
 * restore from a picked file. Uses the platform-independent engine.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { backupMetadata, type BackupMetadata } from '@/database/schema';
import { getDb, SCHEMA_VERSION } from '@/database/client';
import { newId } from '@/utils/id';
import { AppError } from '@/utils/errors';
import { notifyDataChanged } from '@/stores/dataStore';
import { availableBytes, backupsDir, exportsDir, photoFile, photosDir } from '@/services/storage';
import { getSettings, updateSettings } from '@/features/settings/service';
import { createBackupArchive, createJsonExport, inspectBackup, restoreBackup, type PhotoIO, type RestoreResult } from './engine';
import { totalRecords, type ParsedBackup } from './format';
import type { RestoreMode } from './repository';
import { isAutoBackupDue, type AutoBackupTrigger } from './autoBackupPolicy';
import { measurementsCsv, nutritionCsv, personalRecordsCsv, workoutHistoryCsv } from './csv';

const appVersion = () => Constants.expoConfig?.version ?? '1.0.0';

export const devicePhotoIO: PhotoIO = {
  async read(name) {
    try {
      const f = photoFile(name);
      return f.exists ? await f.bytes() : null;
    } catch {
      return null;
    }
  },
  async write(name, bytes) {
    const f = photoFile(name);
    f.create({ overwrite: true });
    f.write(bytes);
  },
  exists(name) {
    try {
      return photoFile(name).exists;
    } catch {
      return false;
    }
  },
  remove(name) {
    try {
      const f = photoFile(name);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  },
  list() {
    return photosDir()
      .list()
      .filter((x): x is File => x instanceof File)
      .map((f) => f.name);
  },
};

function stamp(ms: number) {
  return format(ms, 'yyyyMMdd-HHmmss');
}

function ensureSpace(bytesNeeded: number) {
  const free = availableBytes();
  if (free != null && free < bytesNeeded * 1.2) throw new AppError('Not enough storage space to write the backup.', 'storage_full');
}

export type BackupKind = BackupMetadata['kind'];

/** Create a ZIP backup in private storage and record it in backup_metadata. */
export async function createLocalBackup(kind: BackupKind, includePhotos: boolean): Promise<BackupMetadata> {
  const db = getDb();
  const nowMs = Date.now();
  const { bytes, manifest } = await createBackupArchive(db, devicePhotoIO, { includePhotos, schemaVersion: SCHEMA_VERSION, appVersion: appVersion(), nowMs });
  ensureSpace(bytes.length);
  const fileName = `gym-tracker-${kind}-${stamp(nowMs)}.zip`;
  const file = new File(backupsDir(), fileName);
  file.create({ overwrite: true });
  file.write(bytes);
  const row: BackupMetadata = {
    id: newId(),
    fileName,
    kind,
    sizeBytes: bytes.length,
    schemaVersion: SCHEMA_VERSION,
    includesPhotos: includePhotos,
    checksum: manifest.checksum,
    recordCount: totalRecords(manifest),
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  db.insert(backupMetadata).values(row).run();
  rotateBackups();
  notifyDataChanged();
  return row;
}

/**
 * Retention, applied after every backup of any kind:
 * newest N automatic backups (N = settings.backupRetention) and newest 3 pre-restore backups.
 * Manual backups are kept until the user deletes them.
 */
export function rotateBackups(): void {
  const db = getDb();
  const keep = getSettings().backupRetention;
  const autos = db.select().from(backupMetadata).where(eq(backupMetadata.kind, 'auto')).orderBy(desc(backupMetadata.createdAt)).all();
  const extra = autos.slice(keep);
  for (const b of extra) {
    try {
      const f = new File(backupsDir(), b.fileName);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  }
  if (extra.length) db.delete(backupMetadata).where(inArray(backupMetadata.id, extra.map((b) => b.id))).run();
  // Pre-restore safety backups: keep the latest 3.
  const safety = db.select().from(backupMetadata).where(eq(backupMetadata.kind, 'pre_restore')).orderBy(desc(backupMetadata.createdAt)).all().slice(3);
  for (const b of safety) deleteLocalBackup(b.id, false);
}

export interface LocalBackup extends BackupMetadata {
  fileExists: boolean;
}

export function listLocalBackups(): LocalBackup[] {
  return getDb()
    .select()
    .from(backupMetadata)
    .orderBy(desc(backupMetadata.createdAt))
    .all()
    .map((b) => ({ ...b, fileExists: new File(backupsDir(), b.fileName).exists }));
}

export function deleteLocalBackup(id: string, notify = true): void {
  const db = getDb();
  const b = db.select().from(backupMetadata).where(eq(backupMetadata.id, id)).get();
  if (!b) return;
  try {
    const f = new File(backupsDir(), b.fileName);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
  db.delete(backupMetadata).where(eq(backupMetadata.id, id)).run();
  if (notify) notifyDataChanged();
}

/** Validates a stored backup by re-reading and parsing it. */
export async function verifyLocalBackup(id: string): Promise<ParsedBackup> {
  const b = getDb().select().from(backupMetadata).where(eq(backupMetadata.id, id)).get();
  if (!b) throw new AppError('Backup not found.');
  const f = new File(backupsDir(), b.fileName);
  if (!f.exists) throw new AppError('The backup file is missing from storage.');
  const parsed = inspectBackup(await f.bytes(), SCHEMA_VERSION);
  if (parsed.manifest.checksum !== b.checksum) throw new AppError('Backup file does not match its recorded checksum.');
  return parsed;
}

export async function shareLocalBackup(id: string): Promise<void> {
  const b = getDb().select().from(backupMetadata).where(eq(backupMetadata.id, id)).get();
  if (!b) throw new AppError('Backup not found.');
  await shareFile(new File(backupsDir(), b.fileName), 'application/zip');
}

// ---------------------------------------------------------------------------
// Automatic backups (best effort, foreground checkpoints only)
// ---------------------------------------------------------------------------

let autoBackupRunning = false;


/**
 * Run an automatic data backup when due. Called at safe checkpoints (app launch,
 * moving to background, after finishing a workout). Never throws.
 * Automatic backups contain the database only; photos live in private storage
 * and are included in manual full backups.
 */
export async function runAutoBackupIfDue(trigger: AutoBackupTrigger): Promise<boolean> {
  if (autoBackupRunning) return false;
  autoBackupRunning = true;
  try {
    const s = getSettings();
    if (!isAutoBackupDue(s, trigger, Date.now())) return false;
    await createLocalBackup('auto', false);
    updateSettings({ lastAutoBackupAt: Date.now() });
    return true;
  } catch (e) {
    console.warn('Automatic backup failed', e);
    return false;
  } finally {
    autoBackupRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Manual export
// ---------------------------------------------------------------------------

async function shareFile(file: File, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) throw new AppError('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export Gym Tracker data' });
}

function writeExport(name: string, content: string | Uint8Array): File {
  const f = new File(exportsDir(), name);
  f.create({ overwrite: true });
  f.write(content);
  return f;
}

export type ExportKind = 'full_zip' | 'json' | 'workouts_csv' | 'measurements_csv' | 'nutrition_csv' | 'records_csv';

export const EXPORT_LABELS: Record<ExportKind, string> = {
  full_zip: 'Complete backup (ZIP with photos)',
  json: 'Complete data (JSON)',
  workouts_csv: 'Workout history (CSV)',
  measurements_csv: 'Body measurements (CSV)',
  nutrition_csv: 'Nutrition history (CSV)',
  records_csv: 'Personal records (CSV)',
};

export async function exportData(kind: ExportKind): Promise<void> {
  const db = getDb();
  const ts = stamp(Date.now());
  switch (kind) {
    case 'full_zip': {
      const b = await createLocalBackup('manual', true);
      await shareFile(new File(backupsDir(), b.fileName), 'application/zip');
      return;
    }
    case 'json':
      return shareFile(writeExport(`gym-tracker-${ts}.json`, createJsonExport(db, { schemaVersion: SCHEMA_VERSION, appVersion: appVersion() })), 'application/json');
    case 'workouts_csv':
      return shareFile(writeExport(`workouts-${ts}.csv`, workoutHistoryCsv(db)), 'text/csv');
    case 'measurements_csv':
      return shareFile(writeExport(`measurements-${ts}.csv`, measurementsCsv(db)), 'text/csv');
    case 'nutrition_csv':
      return shareFile(writeExport(`nutrition-${ts}.csv`, nutritionCsv(db)), 'text/csv');
    case 'records_csv':
      return shareFile(writeExport(`personal-records-${ts}.csv`, personalRecordsCsv(db)), 'text/csv');
  }
}

/** Remove temporary export files after sharing. */
export function clearExportCache(): void {
  try {
    exportsDir().delete();
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/** Let the user pick a .zip or .json backup and validate it (no changes yet). */
export async function pickBackupFile(): Promise<ParsedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const bytes = await new File(res.assets[0].uri).bytes();
  return inspectBackup(bytes, SCHEMA_VERSION);
}

/**
 * Restore after the user has confirmed. A safety backup of the current data is
 * written first so the restore itself can be undone.
 */
export async function restoreParsedBackup(parsed: ParsedBackup, mode: RestoreMode): Promise<RestoreResult> {
  // Include photos: a replace restore deletes photo files the new data doesn't reference,
  // so the safety backup must hold them for the restore to be fully undoable.
  await createLocalBackup('pre_restore', true);
  const result = await restoreBackup(getDb(), devicePhotoIO, parsed, mode);
  notifyDataChanged();
  return result;
}

