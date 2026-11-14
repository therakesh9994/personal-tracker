import { getSettings } from '@/features/settings/service';
import type { AppSettings } from '@/database/schema';
import { useQuery } from './useQuery';

const FALLBACK: AppSettings = {
  id: 'default',
  weightUnit: 'kg',
  lengthUnit: 'cm',
  defaultRestSeconds: 90,
  autoStartRestTimer: true,
  timerSound: true,
  timerVibration: true,
  autoBackupEnabled: true,
  autoBackupFrequency: 'daily',
  backupRetention: 7,
  lastAutoBackupAt: null,
  createdAt: 0,
  updatedAt: 0,
};

export function useSettings(): AppSettings {
  return useQuery(getSettings).data ?? FALLBACK;
}
