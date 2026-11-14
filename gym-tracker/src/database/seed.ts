import { eq } from 'drizzle-orm';
import { EXERCISE_LIBRARY } from '@/constants/exerciseLibrary';
import { PLAN_TEMPLATES } from '@/constants/planTemplates';
import { appSettings, exercises, planDays, planExercises, userProfile, workoutPlans } from './schema';
import type { AppDb } from './types';

export const SINGLETON_ID = 'default';

/** Insert built-in exercises that are missing. Never overwrites (favorites/archival preserved). */
export function seedExercises(db: AppDb, nowMs: number = Date.now()): void {
  for (const ex of EXERCISE_LIBRARY) {
    db.insert(exercises)
      .values({
        id: ex.id,
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        secondaryMuscles: JSON.stringify(ex.secondaryMuscles),
        equipment: ex.equipment,
        exerciseType: ex.exerciseType,
        instructions: ex.instructions,
        isCustom: false,
        createdAt: nowMs,
        updatedAt: nowMs,
      })
      .onConflictDoNothing()
      .run();
  }
}

/** Ensure the settings and profile singleton rows exist (defaults). */
export function ensureSingletons(db: AppDb, nowMs: number = Date.now()): void {
  db.insert(appSettings).values({ id: SINGLETON_ID, createdAt: nowMs, updatedAt: nowMs }).onConflictDoNothing().run();
  db.insert(userProfile).values({ id: SINGLETON_ID, createdAt: nowMs, updatedAt: nowMs }).onConflictDoNothing().run();
}

function seedTemplates(db: AppDb, nowMs: number): void {
  for (const tpl of PLAN_TEMPLATES) {
    db.insert(workoutPlans)
      .values({ id: tpl.id, name: tpl.name, description: tpl.description, isTemplate: true, createdAt: nowMs, updatedAt: nowMs })
      .onConflictDoNothing()
      .run();
    tpl.days.forEach((day, di) => {
      const dayId = `${tpl.id}_d${di}`;
      db.insert(planDays)
        .values({ id: dayId, planId: tpl.id, name: day.name, position: di, createdAt: nowMs, updatedAt: nowMs })
        .onConflictDoNothing()
        .run();
      day.exercises.forEach((pe, ei) => {
        db.insert(planExercises)
          .values({
            id: `${dayId}_e${ei}`,
            planDayId: dayId,
            exerciseId: pe.exerciseId,
            position: ei,
            targetSets: pe.sets,
            targetReps: pe.reps,
            targetRepsMax: pe.repsMax ?? null,
            restSeconds: pe.rest,
            createdAt: nowMs,
            updatedAt: nowMs,
          })
          .onConflictDoNothing()
          .run();
      });
    });
  }
}

/**
 * Seeds reference data. Safe to run on every launch:
 * - Built-in exercises are inserted if missing (new app versions can add more).
 * - Settings/profile rows and plan templates are created only on first launch,
 *   so a template the user deleted is not resurrected.
 */
export function seedReferenceData(db: AppDb, nowMs: number = Date.now()): void {
  db.transaction((tx) => {
    seedExercises(tx, nowMs);
    const firstLaunch = !tx.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.id, SINGLETON_ID)).get();
    if (!firstLaunch) return;
    ensureSingletons(tx, nowMs);
    seedTemplates(tx, nowMs);
  });
}
