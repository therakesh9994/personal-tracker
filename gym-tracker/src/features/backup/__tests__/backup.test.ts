import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import { sql } from 'drizzle-orm';
import { createTestDb } from '@/test/testDb';
import { memoryPhotoIO } from '@/test/memoryPhotos';
import * as schema from '@/database/schema';
import { SCHEMA_VERSION } from '@/database/client';
import * as W from '@/features/workouts/service';
import * as N from '@/features/nutrition/service';
import { listAllRecords } from '@/features/personal-records/service';
import { createBackupArchive, createJsonExport, restoreBackup } from '../engine';
import { BackupValidationError, parseBackup } from '../format';
import { toCsv, workoutHistoryCsv } from '../csv';
import { isAutoBackupDue } from '../autoBackupPolicy';

const opts = { schemaVersion: SCHEMA_VERSION, appVersion: 'test', nowMs: 1_700_000_000_000 };

function seedUserData(db: ReturnType<typeof createTestDb>['db']) {
  const sid = W.startWorkout({ name: 'Push' });
  W.addExercise(sid, 'ex_bench_press');
  const setId = W.getSessionDetail(sid)!.exercises[0].sets[0].id;
  W.updateSet(setId, { weightKg: 100, reps: 5 });
  W.setCompleted(setId, true);
  W.finishSession(sid);
  const food = N.createFood({ name: 'Oats', servingSize: 40, servingUnit: 'g', calories: 150, proteinG: 5, carbsG: 27, fatG: 3 });
  N.logFood({ foodId: food, meal: 'breakfast', quantity: 2 });
  N.addWater(500);
  db.insert(schema.progressPhotos).values({ id: 'p1', fileName: 'p1.jpg', takenAt: 1, category: 'front', createdAt: 1, updatedAt: 1 }).run();
  db.insert(schema.progressPhotos).values({ id: 'p2', fileName: 'p2.jpg', takenAt: 2, category: 'back', createdAt: 1, updatedAt: 1 }).run();
  return sid;
}

const count = (db: any, t: any) => Number(db.select({ n: sql<number>`count(*)` }).from(t).get().n);

describe('backup generation and validation', () => {
  it('creates a valid archive including photos and reports missing photo files', async () => {
    const { db } = createTestDb();
    seedUserData(db);
    const photos = memoryPhotoIO({ 'p1.jpg': new Uint8Array([1, 2, 3]) }); // p2.jpg missing on disk
    const { bytes, manifest } = await createBackupArchive(db, photos, { ...opts, includePhotos: true });
    expect(manifest.photoFiles).toEqual(['p1.jpg']);
    expect(manifest.missingPhotos).toEqual(['p2.jpg']);
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['data.json', 'manifest.json', 'photos/p1.jpg']);
    const parsed = parseBackup(bytes, SCHEMA_VERSION);
    expect(parsed.tables.workout_sessions).toHaveLength(1);
    expect(parsed.photos.get('p1.jpg')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects corrupted, foreign, truncated and future backups', async () => {
    const { db } = createTestDb();
    seedUserData(db);
    const { bytes } = await createBackupArchive(db, memoryPhotoIO(), { ...opts, includePhotos: false });
    expect(() => parseBackup(new Uint8Array(), SCHEMA_VERSION)).toThrow(/empty/);
    expect(() => parseBackup(bytes.slice(0, 40), SCHEMA_VERSION)).toThrow(BackupValidationError);
    expect(() => parseBackup(strToU8('not json'), SCHEMA_VERSION)).toThrow(/corrupted/);
    expect(() => parseBackup(strToU8('{"hello":1}'), SCHEMA_VERSION)).toThrow(/not a Gym Tracker backup/);
    expect(() => parseBackup(zipSync({ 'readme.txt': strToU8('x') }), SCHEMA_VERSION)).toThrow(/missing required files/);

    // Tampered data -> checksum mismatch
    const files = unzipSync(bytes);
    const data = JSON.parse(strFromU8(files['data.json']));
    data.tables.water_logs[0].amountMl = 999999;
    expect(() => parseBackup(zipSync({ ...files, 'data.json': strToU8(JSON.stringify(data)) }), SCHEMA_VERSION)).toThrow(/checksum/);

    // Newer schema version -> refused
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    manifest.schemaVersion = SCHEMA_VERSION + 1;
    expect(() => parseBackup(zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(manifest)) }), SCHEMA_VERSION)).toThrow(/newer|Update the app/);

    // Photo listed but missing in archive
    const m2 = JSON.parse(strFromU8(files['manifest.json']));
    m2.photoFiles = ['ghost.jpg'];
    expect(() => parseBackup(zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(m2)) }), SCHEMA_VERSION)).toThrow(/missing from the archive/);
  });
});

describe('restore', () => {
  it('replace: restores data and photos into an empty database', async () => {
    const source = createTestDb();
    const sid = seedUserData(source.db);
    const srcPhotos = memoryPhotoIO({ 'p1.jpg': new Uint8Array([9]), 'p2.jpg': new Uint8Array([8]) });
    const { bytes } = await createBackupArchive(source.db, srcPhotos, { ...opts, includePhotos: true });

    const target = createTestDb();
    const targetPhotos = memoryPhotoIO({ 'orphan.jpg': new Uint8Array([0]) });
    const result = await restoreBackup(target.db, targetPhotos, parseBackup(bytes, SCHEMA_VERSION), 'replace');
    expect(result.photosRestored).toBe(2);
    expect(result.photosMissing).toBe(0);
    expect(targetPhotos.list().sort()).toEqual(['p1.jpg', 'p2.jpg']); // orphan removed
    expect(W.getSessionDetail(sid)!.exercises[0].sets[0]).toMatchObject({ weightKg: 100, reps: 5 });
    expect(count(target.db, schema.nutritionEntries)).toBe(1);
    expect(listAllRecords().length).toBeGreaterThan(0);
  });

  it('merge: skips duplicates and keeps existing data', async () => {
    const { db } = createTestDb();
    seedUserData(db);
    const { bytes } = await createBackupArchive(db, memoryPhotoIO(), { ...opts, includePhotos: false });
    N.addWater(250); // new local data not in backup
    const before = count(db, schema.waterLogs);
    const result = await restoreBackup(db, memoryPhotoIO(), parseBackup(bytes, SCHEMA_VERSION), 'merge');
    expect(result.inserted).toBe(0);
    expect(result.skippedDuplicates).toBeGreaterThan(0);
    expect(count(db, schema.waterLogs)).toBe(before);
    expect(count(db, schema.workoutSessions)).toBe(1);
  });

  it('rolls back the database and written photos when the data is inconsistent', async () => {
    const source = createTestDb();
    seedUserData(source.db);
    const { bytes } = await createBackupArchive(source.db, memoryPhotoIO({ 'p1.jpg': new Uint8Array([1]) }), { ...opts, includePhotos: true });
    const parsed = parseBackup(bytes, SCHEMA_VERSION);
    parsed.tables.workout_sets[0].workoutExerciseId = 'does-not-exist'; // FK violation

    const target = createTestDb();
    N.addWater(123);
    const photos = memoryPhotoIO();
    await expect(restoreBackup(target.db, photos, parsed, 'replace')).rejects.toThrow(/FOREIGN KEY/);
    expect(count(target.db, schema.waterLogs)).toBe(1); // original data untouched
    expect(photos.list()).toEqual([]); // newly written photo cleaned up
  });

  it('round-trips a JSON export', () => {
    const { db } = createTestDb();
    seedUserData(db);
    const json = createJsonExport(db, opts);
    const parsed = parseBackup(strToU8(json), SCHEMA_VERSION);
    expect(parsed.tables.foods).toHaveLength(1);
    expect(parsed.photos.size).toBe(0);
  });
});

describe('csv export', () => {
  it('escapes values', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'he said "hi"']])).toBe('a,b\r\n"x,y","he said ""hi"""\r\n');
  });
  it('exports completed workout sets', () => {
    const { db } = createTestDb();
    seedUserData(db);
    const lines = workoutHistoryCsv(db).trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Barbell Bench Press');
    expect(lines[1]).toContain(',100,5,');
  });
});

describe('auto backup policy', () => {
  const base = { autoBackupEnabled: true, autoBackupFrequency: 'daily' as const, lastAutoBackupAt: null as number | null };
  it('is due on first run and after the interval', () => {
    expect(isAutoBackupDue(base, 'launch', 10)).toBe(true);
    expect(isAutoBackupDue({ ...base, lastAutoBackupAt: 0 }, 'launch', 3_600_000)).toBe(false);
    expect(isAutoBackupDue({ ...base, lastAutoBackupAt: 0 }, 'launch', 86_400_000)).toBe(true);
    expect(isAutoBackupDue({ ...base, autoBackupEnabled: false }, 'launch', 10)).toBe(false);
    expect(isAutoBackupDue({ ...base, autoBackupFrequency: 'after_workout', lastAutoBackupAt: 0 }, 'launch', 1e12)).toBe(false);
    expect(isAutoBackupDue({ ...base, autoBackupFrequency: 'after_workout', lastAutoBackupAt: 0 }, 'workout_finished', 1)).toBe(true);
  });
});
