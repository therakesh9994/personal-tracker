/**
 * Private on-device storage locations (inside the app sandbox, never shared
 * unless the user explicitly exports a file).
 */
import { Directory, File, Paths } from 'expo-file-system';

function ensureDir(...segments: string[]): Directory {
  const dir = new Directory(Paths.document, ...segments);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export const photosDir = (): Directory => ensureDir('photos');
export const backupsDir = (): Directory => ensureDir('backups');

/** Temporary export files (cache, can be purged by the OS). */
export function exportsDir(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function photoFile(fileName: string): File {
  return new File(photosDir(), fileName);
}

export function availableBytes(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}
