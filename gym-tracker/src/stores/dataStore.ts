import { create } from 'zustand';

/**
 * Lightweight change signal. SQLite is the source of truth; screens re-run their
 * queries when this version changes (after any service write).
 */
interface DataVersionState {
  version: number;
  bump: () => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function notifyDataChanged(): void {
  useDataVersion.getState().bump();
}
