/**
 * Gym Tracker SQLite schema (Drizzle ORM).
 *
 * Conventions:
 * - Primary keys are UUID strings (text).
 * - All timestamps are integer milliseconds since the Unix epoch.
 * - Weights are stored in kilograms, lengths in centimeters, water in milliliters.
 * - Optional measurements are nullable.
 * - Historical rows keep snapshots (exercise names, food macros) so they stay valid
 *   when the source record is renamed, edited, or archived.
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

// ---------------------------------------------------------------------------
// User and preferences
// ---------------------------------------------------------------------------

export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(),
  name: text('name'),
  birthDate: integer('birth_date'),
  sex: text('sex', { enum: ['male', 'female', 'other', 'unspecified'] }),
  heightCm: real('height_cm'),
  ...timestamps,
});

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  weightUnit: text('weight_unit', { enum: ['kg', 'lb'] }).notNull().default('kg'),
  lengthUnit: text('length_unit', { enum: ['cm', 'in'] }).notNull().default('cm'),
  defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
  autoStartRestTimer: integer('auto_start_rest_timer', { mode: 'boolean' }).notNull().default(true),
  timerSound: integer('timer_sound', { mode: 'boolean' }).notNull().default(true),
  timerVibration: integer('timer_vibration', { mode: 'boolean' }).notNull().default(true),
  autoBackupEnabled: integer('auto_backup_enabled', { mode: 'boolean' }).notNull().default(true),
  autoBackupFrequency: text('auto_backup_frequency', { enum: ['daily', 'weekly', 'after_workout'] })
    .notNull()
    .default('daily'),
  backupRetention: integer('backup_retention').notNull().default(7),
  lastAutoBackupAt: integer('last_auto_backup_at'),
  ...timestamps,
});

/** Goal history: the goal in effect for a day is the newest row with effective_from <= day. */
export const dailyGoals = sqliteTable(
  'daily_goals',
  {
    id: text('id').primaryKey(),
    effectiveFrom: integer('effective_from').notNull(),
    calories: integer('calories'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    waterMl: integer('water_ml'),
    ...timestamps,
  },
  (t) => [index('daily_goals_effective_idx').on(t.effectiveFrom)],
);

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'abs',
  'cardio',
  'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith_machine',
  'ez_bar',
  'cardio_machine',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_TYPES = ['strength', 'bodyweight', 'cardio', 'mobility'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    primaryMuscle: text('primary_muscle', { enum: MUSCLE_GROUPS }).notNull(),
    /** JSON array of MuscleGroup values. */
    secondaryMuscles: text('secondary_muscles').notNull().default('[]'),
    equipment: text('equipment', { enum: EQUIPMENT }).notNull(),
    instructions: text('instructions').notNull().default(''),
    exerciseType: text('exercise_type', { enum: EXERCISE_TYPES }).notNull().default('strength'),
    defaultRestSeconds: integer('default_rest_seconds'),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    /** Soft delete: archived exercises are hidden but historical workouts keep referencing them. */
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('exercises_name_idx').on(t.name),
    index('exercises_muscle_idx').on(t.primaryMuscle),
    index('exercises_equipment_idx').on(t.equipment),
  ],
);

// ---------------------------------------------------------------------------
// Workout planning
// ---------------------------------------------------------------------------

export const workoutPlans = sqliteTable('workout_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Suggested templates seeded by the app. */
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export const planDays = sqliteTable(
  'plan_days',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => workoutPlans.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    /** 0 = Sunday ... 6 = Saturday; null = unscheduled. */
    dayOfWeek: integer('day_of_week'),
    ...timestamps,
  },
  (t) => [index('plan_days_plan_idx').on(t.planId, t.position)],
);

export const planExercises = sqliteTable(
  'plan_exercises',
  {
    id: text('id').primaryKey(),
    planDayId: text('plan_day_id')
      .notNull()
      .references(() => planDays.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    targetReps: integer('target_reps').notNull().default(10),
    targetRepsMax: integer('target_reps_max'),
    restSeconds: integer('rest_seconds').notNull().default(90),
    targetWeightKg: real('target_weight_kg'),
    ...timestamps,
  },
  (t) => [
    index('plan_exercises_day_idx').on(t.planDayId, t.position),
    index('plan_exercises_exercise_idx').on(t.exerciseId),
  ],
);

// ---------------------------------------------------------------------------
// Workout management
// ---------------------------------------------------------------------------

export const SESSION_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status', { enum: SESSION_STATUSES }).notNull(),
    planId: text('plan_id').references(() => workoutPlans.id, { onDelete: 'set null' }),
    planDayId: text('plan_day_id').references(() => planDays.id, { onDelete: 'set null' }),
    sourceSessionId: text('source_session_id'),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /** Set while paused; cleared on resume. */
    pausedAt: integer('paused_at'),
    totalPausedMs: integer('total_paused_ms').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('workout_sessions_status_idx').on(t.status),
    index('workout_sessions_started_idx').on(t.startedAt),
  ],
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    /** Snapshots keep history readable if the exercise is renamed or archived. */
    exerciseName: text('exercise_name').notNull(),
    primaryMuscle: text('primary_muscle', { enum: MUSCLE_GROUPS }).notNull(),
    position: integer('position').notNull(),
    restSeconds: integer('rest_seconds'),
    ...timestamps,
  },
  (t) => [
    index('workout_exercises_session_idx').on(t.sessionId, t.position),
    index('workout_exercises_exercise_idx').on(t.exerciseId),
  ],
);

export const SET_TYPES = ['warmup', 'working', 'drop', 'failure', 'other'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    setType: text('set_type', { enum: SET_TYPES }).notNull().default('working'),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    rpe: real('rpe'),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at'),
    ...timestamps,
  },
  (t) => [
    index('workout_sets_exercise_idx').on(t.workoutExerciseId, t.setNumber),
    index('workout_sets_completed_idx').on(t.isCompleted, t.completedAt),
  ],
);

export const workoutNotes = sqliteTable(
  'workout_notes',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    /** null = note for the whole session. */
    workoutExerciseId: text('workout_exercise_id').references(() => workoutExercises.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    ...timestamps,
  },
  (t) => [index('workout_notes_session_idx').on(t.sessionId, t.workoutExerciseId)],
);

// ---------------------------------------------------------------------------
// Body tracking
// ---------------------------------------------------------------------------

export const bodyMeasurements = sqliteTable(
  'body_measurements',
  {
    id: text('id').primaryKey(),
    measuredAt: integer('measured_at').notNull(),
    weightKg: real('weight_kg'),
    bodyFatPct: real('body_fat_pct'),
    chestCm: real('chest_cm'),
    waistCm: real('waist_cm'),
    hipsCm: real('hips_cm'),
    leftArmCm: real('left_arm_cm'),
    rightArmCm: real('right_arm_cm'),
    leftThighCm: real('left_thigh_cm'),
    rightThighCm: real('right_thigh_cm'),
    leftCalfCm: real('left_calf_cm'),
    rightCalfCm: real('right_calf_cm'),
    neckCm: real('neck_cm'),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('body_measurements_date_idx').on(t.measuredAt)],
);

export const PHOTO_CATEGORIES = ['front', 'back', 'left', 'right', 'other'] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const progressPhotos = sqliteTable(
  'progress_photos',
  {
    id: text('id').primaryKey(),
    /** File name inside the app's private photos directory (path is resolved at runtime). */
    fileName: text('file_name').notNull().unique(),
    takenAt: integer('taken_at').notNull(),
    category: text('category', { enum: PHOTO_CATEGORIES }).notNull(),
    bodyWeightKg: real('body_weight_kg'),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('progress_photos_date_idx').on(t.takenAt)],
);

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export const RECORD_TYPES = ['max_weight', 'max_reps', 'estimated_1rm', 'max_set_volume', 'best_session_volume'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const personalRecords = sqliteTable(
  'personal_records',
  {
    id: text('id').primaryKey(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    recordType: text('record_type', { enum: RECORD_TYPES }).notNull(),
    value: real('value').notNull(),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    isEstimate: integer('is_estimate', { mode: 'boolean' }).notNull().default(false),
    workoutSetId: text('workout_set_id').references(() => workoutSets.id, { onDelete: 'set null' }),
    sessionId: text('session_id').references(() => workoutSessions.id, { onDelete: 'set null' }),
    achievedAt: integer('achieved_at').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('personal_records_exercise_type_uq').on(t.exerciseId, t.recordType)],
);

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    servingSize: real('serving_size').notNull(),
    servingUnit: text('serving_unit').notNull(),
    calories: real('calories').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    lastUsedAt: integer('last_used_at'),
    ...timestamps,
  },
  (t) => [index('foods_name_idx').on(t.name)],
);

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const nutritionEntries = sqliteTable(
  'nutrition_entries',
  {
    id: text('id').primaryKey(),
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    loggedAt: integer('logged_at').notNull(),
    meal: text('meal', { enum: MEAL_TYPES }).notNull(),
    /** Number of servings. */
    quantity: real('quantity').notNull(),
    // Snapshot of the food at logging time (per serving).
    foodName: text('food_name').notNull(),
    servingSize: real('serving_size').notNull(),
    servingUnit: text('serving_unit').notNull(),
    caloriesPerServing: real('calories_per_serving').notNull(),
    proteinPerServing: real('protein_per_serving').notNull(),
    carbsPerServing: real('carbs_per_serving').notNull(),
    fatPerServing: real('fat_per_serving').notNull(),
    ...timestamps,
  },
  (t) => [index('nutrition_entries_logged_idx').on(t.loggedAt)],
);

export const waterLogs = sqliteTable(
  'water_logs',
  {
    id: text('id').primaryKey(),
    amountMl: integer('amount_ml').notNull(),
    loggedAt: integer('logged_at').notNull(),
    ...timestamps,
  },
  (t) => [index('water_logs_logged_idx').on(t.loggedAt)],
);

// ---------------------------------------------------------------------------
// Backup management
// ---------------------------------------------------------------------------

export const backupMetadata = sqliteTable(
  'backup_metadata',
  {
    id: text('id').primaryKey(),
    fileName: text('file_name').notNull(),
    kind: text('kind', { enum: ['auto', 'manual', 'pre_restore'] }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    includesPhotos: integer('includes_photos', { mode: 'boolean' }).notNull(),
    checksum: text('checksum').notNull(),
    recordCount: integer('record_count').notNull(),
    ...timestamps,
  },
  (t) => [index('backup_metadata_created_idx').on(t.createdAt)],
);

export type Exercise = typeof exercises.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type WorkoutNote = typeof workoutNotes.$inferSelect;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type NutritionEntry = typeof nutritionEntries.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type UserProfile = typeof userProfile.$inferSelect;
export type DailyGoal = typeof dailyGoals.$inferSelect;
export type BackupMetadata = typeof backupMetadata.$inferSelect;
