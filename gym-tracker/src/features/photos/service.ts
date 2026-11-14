import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { File } from 'expo-file-system';
import { PHOTO_CATEGORIES, progressPhotos, type PhotoCategory, type ProgressPhoto } from '@/database/schema';
import { getDb } from '@/database/client';
import { AppError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';
import { availableBytes, photoFile } from '@/services/storage';

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left side',
  right: 'Right side',
  other: 'Other',
};

const photoSchema = z.object({
  category: z.enum(PHOTO_CATEGORIES),
  takenAt: z.number().int(),
  bodyWeightKg: z.number().min(20).max(400).nullable(),
  notes: z.string().max(500).default(''),
});

/**
 * Copy a picked/captured image into private app storage and record it.
 * If the database insert fails, the copied file is removed again.
 */
export async function addPhoto(input: { sourceUri: string } & z.input<typeof photoSchema>): Promise<string> {
  const v = validate(photoSchema, input);
  const source = new File(input.sourceUri);
  if (!source.exists) throw new AppError('The selected image could not be read.');
  const free = availableBytes();
  if (free != null && source.size > 0 && free < source.size * 2) {
    throw new AppError('Not enough storage space to save this photo.', 'storage_full');
  }
  const id = newId();
  const ext = (source.extension || '.jpg').toLowerCase();
  const fileName = `${id}${ext.startsWith('.') ? ext : `.${ext}`}`;
  const dest = photoFile(fileName);
  await source.copy(dest);
  try {
    const nowMs = Date.now();
    getDb().insert(progressPhotos).values({ id, fileName, ...v, createdAt: nowMs, updatedAt: nowMs }).run();
  } catch (e) {
    if (dest.exists) dest.delete();
    throw e;
  }
  notifyDataChanged();
  return id;
}

export function updatePhoto(id: string, patch: Partial<z.input<typeof photoSchema>>): void {
  const v = validate(photoSchema.partial(), patch);
  getDb().update(progressPhotos).set({ ...v, updatedAt: Date.now() }).where(eq(progressPhotos.id, id)).run();
  notifyDataChanged();
}

/** Delete the record and its file. A missing file is not an error. */
export function deletePhoto(id: string): void {
  const db = getDb();
  const p = db.select().from(progressPhotos).where(eq(progressPhotos.id, id)).get();
  if (!p) return;
  db.delete(progressPhotos).where(eq(progressPhotos.id, id)).run();
  try {
    const f = photoFile(p.fileName);
    if (f.exists) f.delete();
  } catch {
    // The record is gone; an orphaned file is harmless and is skipped by backups.
  }
  notifyDataChanged();
}

export function getPhoto(id: string): ProgressPhoto | null {
  return getDb().select().from(progressPhotos).where(eq(progressPhotos.id, id)).get() ?? null;
}

export function listPhotos(filter: { category?: PhotoCategory | null; from?: number; to?: number } = {}): ProgressPhoto[] {
  return getDb()
    .select()
    .from(progressPhotos)
    .where(
      and(
        filter.category ? eq(progressPhotos.category, filter.category) : undefined,
        filter.from != null ? gte(progressPhotos.takenAt, filter.from) : undefined,
        filter.to != null ? lte(progressPhotos.takenAt, filter.to) : undefined,
      ),
    )
    .orderBy(desc(progressPhotos.takenAt))
    .all();
}

export function photoUri(p: Pick<ProgressPhoto, 'fileName'>): string {
  return photoFile(p.fileName).uri;
}

export function photoExists(p: Pick<ProgressPhoto, 'fileName'>): boolean {
  try {
    return photoFile(p.fileName).exists;
  } catch {
    return false;
  }
}
