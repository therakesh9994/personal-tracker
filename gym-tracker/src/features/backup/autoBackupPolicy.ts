export type AutoBackupTrigger = 'launch' | 'background' | 'workout_finished';

export function isAutoBackupDue(
  s: { autoBackupEnabled: boolean; autoBackupFrequency: 'daily' | 'weekly' | 'after_workout'; lastAutoBackupAt: number | null },
  trigger: AutoBackupTrigger,
  nowMs: number,
): boolean {
  if (!s.autoBackupEnabled) return false;
  if (s.autoBackupFrequency === 'after_workout') return trigger === 'workout_finished' || s.lastAutoBackupAt == null;
  const interval = s.autoBackupFrequency === 'daily' ? 86_400_000 : 7 * 86_400_000;
  return s.lastAutoBackupAt == null || nowMs - s.lastAutoBackupAt >= interval;
}
