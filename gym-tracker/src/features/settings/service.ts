import { and, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';
import { appSettings, dailyGoals, userProfile, type AppSettings, type DailyGoal, type UserProfile } from '@/database/schema';
import { getDb } from '@/database/client';
import { SINGLETON_ID } from '@/database/seed';
import { validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';
import { startOfDay } from 'date-fns';

export function getSettings(): AppSettings {
  const s = getDb().select().from(appSettings).where(eq(appSettings.id, SINGLETON_ID)).get();
  if (!s) throw new Error('Settings row missing; database was not seeded.');
  return s;
}

const settingsSchema = z
  .object({
    weightUnit: z.enum(['kg', 'lb']),
    lengthUnit: z.enum(['cm', 'in']),
    defaultRestSeconds: z.number().int().min(5, 'Rest must be at least 5 seconds.').max(1800, 'Rest must be at most 30 minutes.'),
    autoStartRestTimer: z.boolean(),
    timerSound: z.boolean(),
    timerVibration: z.boolean(),
    autoBackupEnabled: z.boolean(),
    autoBackupFrequency: z.enum(['daily', 'weekly', 'after_workout']),
    backupRetention: z.number().int().min(1, 'Keep at least 1 backup.').max(30, 'Keep at most 30 backups.'),
    lastAutoBackupAt: z.number().int().nullable(),
  })
  .partial();

export function updateSettings(patch: z.input<typeof settingsSchema>): void {
  const v = validate(settingsSchema, patch);
  getDb().update(appSettings).set({ ...v, updatedAt: Date.now() }).where(eq(appSettings.id, SINGLETON_ID)).run();
  notifyDataChanged();
}

export function getProfile(): UserProfile {
  const db = getDb();
  const p = db.select().from(userProfile).where(eq(userProfile.id, SINGLETON_ID)).get();
  if (p) return p;
  const nowMs = Date.now();
  db.insert(userProfile).values({ id: SINGLETON_ID, createdAt: nowMs, updatedAt: nowMs }).run();
  return db.select().from(userProfile).where(eq(userProfile.id, SINGLETON_ID)).get()!;
}

const profileSchema = z.object({
  name: z.string().trim().max(60, 'Name is too long.').nullable(),
  heightCm: z.number().min(50, 'Height looks too small.').max(272, 'Height looks too large.').nullable(),
  birthDate: z.number().int().nullable(),
  sex: z.enum(['male', 'female', 'other', 'unspecified']).nullable(),
}).partial();

export function updateProfile(patch: z.input<typeof profileSchema>): void {
  const v = validate(profileSchema, patch);
  getProfile();
  getDb().update(userProfile).set({ ...v, name: v.name === '' ? null : v.name, updatedAt: Date.now() }).where(eq(userProfile.id, SINGLETON_ID)).run();
  notifyDataChanged();
}

// ---------------------------------------------------------------------------
// Daily goals (history-preserving)
// ---------------------------------------------------------------------------

export const goalsSchema = z.object({
  calories: z.number().int().min(0).max(20000).nullable(),
  proteinG: z.number().min(0).max(2000).nullable(),
  carbsG: z.number().min(0).max(2000).nullable(),
  fatG: z.number().min(0).max(2000).nullable(),
  waterMl: z.number().int().min(0).max(20000).nullable(),
});
export type GoalsInput = z.infer<typeof goalsSchema>;

/** Goals in effect for the given day (null if never set). */
export function getGoalsForDay(dayMs: number = Date.now()): DailyGoal | null {
  const end = startOfDay(dayMs).getTime();
  return (
    getDb()
      .select()
      .from(dailyGoals)
      .where(and(lte(dailyGoals.effectiveFrom, end)))
      .orderBy(desc(dailyGoals.effectiveFrom), desc(dailyGoals.createdAt))
      .limit(1)
      .get() ?? null
  );
}

/** Set goals from today onwards. Past days keep the goals that applied then. */
export function setGoals(input: GoalsInput, nowMs = Date.now()): void {
  const v = validate(goalsSchema, input);
  const db = getDb();
  const effectiveFrom = startOfDay(nowMs).getTime();
  db.transaction((tx) => {
    const today = tx.select().from(dailyGoals).where(eq(dailyGoals.effectiveFrom, effectiveFrom)).get();
    if (today) {
      tx.update(dailyGoals).set({ ...v, updatedAt: nowMs }).where(eq(dailyGoals.id, today.id)).run();
    } else {
      tx.insert(dailyGoals).values({ id: newId(), effectiveFrom, ...v, createdAt: nowMs, updatedAt: nowMs }).run();
    }
  });
  notifyDataChanged();
}
