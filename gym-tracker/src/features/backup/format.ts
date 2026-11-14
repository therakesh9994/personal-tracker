/**
 * Backup archive format (pure, platform-independent).
 *
 * ZIP layout:
 *   manifest.json   – format, versions, counts, checksum, photo list
 *   data.json       – { tables: { <table>: rows[] } }
 *   photos/<file>   – progress photo files (full backups only)
 *
 * A JSON export is the same manifest + tables in a single file (no photos).
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import { AppError } from '@/utils/errors';

export const BACKUP_FORMAT = 'gym-tracker-backup';
export const BACKUP_FORMAT_VERSION = 1;

/** Tables in foreign-key-safe insertion order. backup_metadata is device-local and excluded. */
export const BACKUP_TABLES = [
  'user_profile',
  'app_settings',
  'daily_goals',
  'exercises',
  'workout_plans',
  'plan_days',
  'plan_exercises',
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
  'workout_notes',
  'body_measurements',
  'progress_photos',
  'personal_records',
  'foods',
  'nutrition_entries',
  'water_logs',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Row = Record<string, unknown> & { id: string };
export type BackupTables = Record<BackupTable, Row[]>;

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  createdAt: z.number().int(),
  includesPhotos: z.boolean(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  photoFiles: z.array(z.string()),
  missingPhotos: z.array(z.string()).default([]),
  checksum: z.string(),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

export class BackupValidationError extends AppError {
  constructor(message: string) {
    super(message, 'backup_invalid');
    this.name = 'BackupValidationError';
  }
}

/** FNV-1a 32-bit hash: detects truncation/corruption (integrity, not security). */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function buildManifest(
  tables: BackupTables,
  opts: { schemaVersion: number; appVersion: string; createdAt: number; photoFiles: string[]; missingPhotos?: string[]; includesPhotos: boolean },
  dataJson: string,
): BackupManifest {
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) counts[t] = tables[t]?.length ?? 0;
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: opts.schemaVersion,
    appVersion: opts.appVersion,
    createdAt: opts.createdAt,
    includesPhotos: opts.includesPhotos,
    counts,
    photoFiles: opts.photoFiles,
    missingPhotos: opts.missingPhotos ?? [],
    checksum: checksum(dataJson),
  };
}

const SAFE_PHOTO_NAME = /^[A-Za-z0-9._-]+$/;

export interface BuildArchiveInput {
  tables: BackupTables;
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  /** Photo bytes by file name. A null value means the file was missing on disk. */
  photos?: Map<string, Uint8Array | null>;
}

export function buildArchive(input: BuildArchiveInput): { bytes: Uint8Array; manifest: BackupManifest } {
  const dataJson = JSON.stringify({ tables: input.tables });
  const photoFiles: string[] = [];
  const missingPhotos: string[] = [];
  const files: Zippable = {};
  if (input.photos) {
    for (const [name, bytes] of input.photos) {
      if (!SAFE_PHOTO_NAME.test(name)) continue;
      if (bytes == null) {
        missingPhotos.push(name);
        continue;
      }
      photoFiles.push(name);
      // Images are already compressed: store without deflate.
      files[`photos/${name}`] = [bytes, { level: 0 }];
    }
  }
  const manifest = buildManifest(
    input.tables,
    { ...input, photoFiles, missingPhotos, includesPhotos: input.photos != null },
    dataJson,
  );
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['data.json'] = strToU8(dataJson);
  return { bytes: zipSync(files, { level: 6 }), manifest };
}

export function buildJsonExport(input: Omit<BuildArchiveInput, 'photos'>): string {
  const dataJson = JSON.stringify({ tables: input.tables });
  const manifest = buildManifest(input.tables, { ...input, photoFiles: [], includesPhotos: false }, dataJson);
  return JSON.stringify({ manifest, tables: input.tables });
}

export interface ParsedBackup {
  manifest: BackupManifest;
  tables: BackupTables;
  photos: Map<string, Uint8Array>;
}

function validateTables(raw: unknown, manifest: BackupManifest): BackupTables {
  if (!raw || typeof raw !== 'object') throw new BackupValidationError('Backup data is missing its tables.');
  const src = raw as Record<string, unknown>;
  const out = {} as BackupTables;
  for (const t of BACKUP_TABLES) {
    const rows = src[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupValidationError(`Table "${t}" is malformed.`);
    const ids = new Set<string>();
    for (const r of rows) {
      if (!r || typeof r !== 'object' || typeof (r as Row).id !== 'string' || !(r as Row).id) {
        throw new BackupValidationError(`Table "${t}" contains an invalid record.`);
      }
      if (ids.has((r as Row).id)) throw new BackupValidationError(`Table "${t}" contains duplicate records.`);
      ids.add((r as Row).id);
    }
    if ((manifest.counts[t] ?? 0) !== rows.length) {
      throw new BackupValidationError(`Record count mismatch in "${t}" — the backup may be incomplete.`);
    }
    out[t] = rows as Row[];
  }
  return out;
}

function validateManifest(raw: unknown, currentSchemaVersion: number): BackupManifest {
  const r = manifestSchema.safeParse(raw);
  if (!r.success) throw new BackupValidationError('This file is not a Gym Tracker backup.');
  const m = r.data;
  if (m.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError('This backup was made by a newer version of Gym Tracker. Update the app to restore it.');
  }
  if (m.schemaVersion > currentSchemaVersion) {
    throw new BackupValidationError(
      `This backup uses database schema v${m.schemaVersion}, but this app supports up to v${currentSchemaVersion}. Update the app to restore it.`,
    );
  }
  return m;
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupValidationError(`The ${what} is corrupted (invalid JSON).`);
  }
}

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;

/** Parse and fully validate a ZIP or JSON backup. Throws BackupValidationError. */
export function parseBackup(bytes: Uint8Array, currentSchemaVersion: number): ParsedBackup {
  if (bytes.length === 0) throw new BackupValidationError('The selected file is empty.');

  if (!isZip(bytes)) {
    const doc = parseJson(strFromU8(bytes), 'backup file') as { manifest?: unknown; tables?: unknown };
    const manifest = validateManifest(doc?.manifest, currentSchemaVersion);
    const dataJson = JSON.stringify({ tables: doc.tables });
    if (checksum(dataJson) !== manifest.checksum) throw new BackupValidationError('Backup integrity check failed (checksum mismatch).');
    return { manifest, tables: validateTables(doc.tables, manifest), photos: new Map() };
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupValidationError('The archive is corrupted and cannot be opened.');
  }
  if (!entries['manifest.json'] || !entries['data.json']) {
    throw new BackupValidationError('The archive is missing required files (manifest.json, data.json).');
  }
  const manifest = validateManifest(parseJson(strFromU8(entries['manifest.json']), 'manifest'), currentSchemaVersion);
  const dataJson = strFromU8(entries['data.json']);
  if (checksum(dataJson) !== manifest.checksum) throw new BackupValidationError('Backup integrity check failed (checksum mismatch).');
  const data = parseJson(dataJson, 'backup data') as { tables?: unknown };
  const tables = validateTables(data?.tables, manifest);

  const photos = new Map<string, Uint8Array>();
  for (const name of manifest.photoFiles) {
    if (!SAFE_PHOTO_NAME.test(name)) throw new BackupValidationError('The archive contains an invalid photo name.');
    const f = entries[`photos/${name}`];
    if (!f) throw new BackupValidationError(`Photo "${name}" listed in the manifest is missing from the archive.`);
    photos.set(name, f);
  }
  return { manifest, tables, photos };
}

export function totalRecords(m: Pick<BackupManifest, 'counts'>): number {
  return Object.values(m.counts).reduce((a, b) => a + b, 0);
}
