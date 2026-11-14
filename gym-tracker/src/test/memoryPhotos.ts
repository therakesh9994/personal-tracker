import type { PhotoIO } from '@/features/backup/engine';

/** In-memory stand-in for the private photos directory. */
export function memoryPhotoIO(initial: Record<string, Uint8Array> = {}): PhotoIO & { files: Map<string, Uint8Array> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async read(n) {
      return files.get(n) ?? null;
    },
    async write(n, b) {
      files.set(n, b);
    },
    exists: (n) => files.has(n),
    remove: (n) => void files.delete(n),
    list: () => [...files.keys()],
  };
}
