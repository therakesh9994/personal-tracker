CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`length_unit` text DEFAULT 'cm' NOT NULL,
	`default_rest_seconds` integer DEFAULT 90 NOT NULL,
	`auto_start_rest_timer` integer DEFAULT true NOT NULL,
	`timer_sound` integer DEFAULT true NOT NULL,
	`timer_vibration` integer DEFAULT true NOT NULL,
	`auto_backup_enabled` integer DEFAULT true NOT NULL,
	`auto_backup_frequency` text DEFAULT 'daily' NOT NULL,
	`backup_retention` integer DEFAULT 7 NOT NULL,
	`last_auto_backup_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`kind` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`includes_photos` integer NOT NULL,
	`checksum` text NOT NULL,
	`record_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backup_metadata_created_idx` ON `backup_metadata` (`created_at`);--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`measured_at` integer NOT NULL,
	`weight_kg` real,
	`body_fat_pct` real,
	`chest_cm` real,
	`waist_cm` real,
	`hips_cm` real,
	`left_arm_cm` real,
	`right_arm_cm` real,
	`left_thigh_cm` real,
	`right_thigh_cm` real,
	`left_calf_cm` real,
	`right_calf_cm` real,
	`neck_cm` real,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_measurements_date_idx` ON `body_measurements` (`measured_at`);--> statement-breakpoint
CREATE TABLE `daily_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`effective_from` integer NOT NULL,
	`calories` integer,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`water_ml` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_goals_effective_idx` ON `daily_goals` (`effective_from`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`primary_muscle` text NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`exercise_type` text DEFAULT 'strength' NOT NULL,
	`default_rest_seconds` integer,
	`is_custom` integer DEFAULT false NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE INDEX `exercises_muscle_idx` ON `exercises` (`primary_muscle`);--> statement-breakpoint
CREATE INDEX `exercises_equipment_idx` ON `exercises` (`equipment`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`serving_size` real NOT NULL,
	`serving_unit` text NOT NULL,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE TABLE `nutrition_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text,
	`logged_at` integer NOT NULL,
	`meal` text NOT NULL,
	`quantity` real NOT NULL,
	`food_name` text NOT NULL,
	`serving_size` real NOT NULL,
	`serving_unit` text NOT NULL,
	`calories_per_serving` real NOT NULL,
	`protein_per_serving` real NOT NULL,
	`carbs_per_serving` real NOT NULL,
	`fat_per_serving` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `nutrition_entries_logged_idx` ON `nutrition_entries` (`logged_at`);--> statement-breakpoint
CREATE TABLE `personal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`record_type` text NOT NULL,
	`value` real NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`is_estimate` integer DEFAULT false NOT NULL,
	`workout_set_id` text,
	`session_id` text,
	`achieved_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_set_id`) REFERENCES `workout_sets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_records_exercise_type_uq` ON `personal_records` (`exercise_id`,`record_type`);--> statement-breakpoint
CREATE TABLE `plan_days` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`day_of_week` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_days_plan_idx` ON `plan_days` (`plan_id`,`position`);--> statement-breakpoint
CREATE TABLE `plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`target_reps` integer DEFAULT 10 NOT NULL,
	`target_reps_max` integer,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`target_weight_kg` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `plan_exercises_day_idx` ON `plan_exercises` (`plan_day_id`,`position`);--> statement-breakpoint
CREATE INDEX `plan_exercises_exercise_idx` ON `plan_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`taken_at` integer NOT NULL,
	`category` text NOT NULL,
	`body_weight_kg` real,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_photos_file_name_unique` ON `progress_photos` (`file_name`);--> statement-breakpoint
CREATE INDEX `progress_photos_date_idx` ON `progress_photos` (`taken_at`);--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`birth_date` integer,
	`sex` text,
	`height_cm` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_logs_logged_idx` ON `water_logs` (`logged_at`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_name` text NOT NULL,
	`primary_muscle` text NOT NULL,
	`position` integer NOT NULL,
	`rest_seconds` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_session_idx` ON `workout_exercises` (`session_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_exercises_exercise_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`workout_exercise_id` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_notes_session_idx` ON `workout_notes` (`session_id`,`workout_exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`plan_id` text,
	`plan_day_id` text,
	`source_session_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`paused_at` integer,
	`total_paused_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workout_sessions_status_idx` ON `workout_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `workout_sessions_started_idx` ON `workout_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`set_type` text DEFAULT 'working' NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`rpe` real,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_idx` ON `workout_sets` (`workout_exercise_id`,`set_number`);--> statement-breakpoint
CREATE INDEX `workout_sets_completed_idx` ON `workout_sets` (`is_completed`,`completed_at`);