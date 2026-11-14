GYM TRACKER
Complete Mobile Application Development Specification

Project: Gym Tracker
Version: 1.0
Platforms: Android and iOS
Framework: React Native + Expo
Language: TypeScript
Architecture: Offline-first, local-first
Backend: None
Database: SQLite
Design: Premium dark theme
Application language: English

1. ROLE AND OBJECTIVE

Act as a senior React Native developer, mobile application architect, UI/UX designer, database engineer, and QA engineer.

Your task is to design, develop, test, and deliver a complete, production-quality Gym Tracker mobile application.

Do not just provide architectural explanations, code snippets, mockups, or tutorials.

You must create the actual application with a complete project structure, working screens, database operations, business logic, navigation, and functional features.

The final application must run on Android and iOS.

Core principle

The entire application must work offline.

No backend server.
No REST API.
No GraphQL API.
No cloud database.
No mandatory user registration.
No mandatory internet connection.
No external service dependency.
All fitness data must remain on the user's device.

The local database must be the single source of truth.

2. TECHNOLOGY STACK

Use the following technology stack.

Component	Technology
Mobile framework	React Native
Development framework	Expo
Language	TypeScript
Navigation	Expo Router
Database	SQLite
Database ORM	Drizzle ORM
Database integration	expo-sqlite
State management	Zustand
Charts	Victory Native
Icons	Lucide React Native
Image selection	expo-image-picker
File storage	expo-file-system
File sharing	expo-sharing
Notifications	expo-notifications
Date handling	date-fns
ID generation	uuid
Form validation	Zod
Testing	Jest / React Native Testing Library
Development builds	Expo Development Build

Use package versions compatible with the installed Expo SDK.

Prefer Expo-compatible native packages and use npx expo install for Expo-managed dependencies.

Do not introduce unnecessary dependencies.

3. DESIGN SYSTEM

Create a premium fitness application with a black and neon green design.

Color palette
Element	Color
Main background	#090B0A
Card background	#171B19
Secondary background	#202622
Primary accent	#B6F23A
Secondary accent	#354329
Primary text	#F5F7F5
Secondary text	#929B95
Success	#65D98B
Error	#FF5C5C
Warning	#F4B942
Border	#292F2B
Design guidelines
Premium dark interface.
Minimal and modern layouts.
Rounded cards.
Consistent spacing.
Smooth navigation.
Subtle animations.
Readable typography.
Large workout action buttons.
Clear data visualizations.
Accessible contrast.
Consistent iconography.
Responsive layouts for different phone sizes.

Create reusable design tokens and components.

Avoid unnecessary gradients, excessive animations, and cluttered screens.

All screens must follow the same design system.

4. APPLICATION NAVIGATION

Create five primary bottom navigation tabs.

Tab 1: Home

Dashboard containing:

Greeting and current date.
Total completed workouts.
Weekly workout count.
Current workout streak.
Today's workout plan.
Start workout button.
Recent workouts.
Weekly activity chart.
Daily calorie summary.
Body weight summary.
Quick actions.
Tab 2: Workout

Contains:

Start workout.
Active workout.
Workout history.
Workout plans.
Exercise library.
Custom exercise creation.
Saved workout templates.
Tab 3: Progress

Contains:

Strength progression.
Body weight history.
Body measurement history.
Personal records.
Training volume.
Weekly activity.
Monthly reports.
Progress photo comparisons.
Tab 4: Nutrition

Contains:

Daily calorie tracking.
Protein tracking.
Carbohydrate tracking.
Fat tracking.
Manual food creation.
Meal logging.
Water tracking.
Daily nutrition goals.
Tab 5: Profile

Contains:

Personal information.
Height and body weight.
Unit preferences.
Progress photos.
App settings.
Database backup.
Data export.
Data restore.
About application.
5. WORKOUT TRACKING MODULE

This is the most important module.

Implement a fully functional workout tracking system.

Starting a workout

Users must be able to:

Start an empty workout.
Start from an existing workout plan.
Start from a previous workout.
Give the workout a custom name.
Add exercises during the workout.
Reorder exercises.
Remove exercises.
Recording sets

Each set must support:

Set number.
Set type.
Weight in kilograms.
Repetitions.
RPE.
Completion status.
Completion timestamp.

Supported set types:

Warm-up.
Working.
Drop set.
Failure set.
Other.

Users must be able to:

Add sets.
Edit sets.
Delete sets.
Duplicate previous sets.
Mark sets completed.
View previous performance.
Compare current sets with previous sessions.
Workout session controls

Implement:

Start.
Pause.
Resume.
Finish.
Cancel.
Save notes.
Recover unfinished workout after app restart.

Do not lose workout information if the application is closed unexpectedly.

Use SQLite transactions when saving related workout records.

Workout calculations

Training volume:

Volume = Weight × Repetitions

Total session volume:

Sum of completed working set volumes.

Calculate:

Total completed sets.
Total repetitions.
Total training volume.
Workout duration.
Exercise count.
Muscle group distribution.
6. REST TIMER

Implement a functional rest timer.

Presets:

30 seconds.
60 seconds.
90 seconds.
120 seconds.
180 seconds.
Custom duration.

Features:

Start.
Pause.
Resume.
Reset.
Sound alert.
Vibration alert.
Background notifications.
Automatic timer suggestion.

The timer must remain accurate if the app moves into the background.

Use timestamps rather than relying solely on JavaScript intervals.

7. EXERCISE LIBRARY

Create a searchable local exercise database.

Organize exercises by:

Chest.
Back.
Shoulders.
Biceps.
Triceps.
Legs.
Glutes.
Abs.
Cardio.
Full body.

Each exercise should have:

Unique ID.
Exercise name.
Primary muscle.
Secondary muscles.
Equipment.
Instructions.
Exercise type.
Custom exercise flag.
Favorite flag.

Include an initial collection of commonly used exercises.

Users must be able to:

Search exercises.
Filter by muscle group.
Filter by equipment.
Add custom exercises.
Edit custom exercises.
Favorite exercises.

Do not require internet access to view the exercise library.

8. WORKOUT PLAN MODULE

Allow users to create reusable workout plans.

Include suggested templates:

Push / Pull / Legs.
Upper / Lower.
Bro Split.
Full Body.
Custom plan.

Each plan should support:

Plan name.
Description.
Training days.
Exercises.
Exercise order.
Target sets.
Target repetitions.
Rest duration.
Optional target weight.

Users must be able to edit, duplicate, delete, and start plans.

Completing a workout must not modify the original plan.

9. BODY MEASUREMENT MODULE

Track body statistics over time.

Supported measurements:

Body weight.
Body fat percentage.
Chest.
Waist.
Hips.
Left arm.
Right arm.
Left thigh.
Right thigh.
Left calf.
Right calf.
Neck.

Features:

Add measurement.
Edit measurement.
Delete measurement.
View historical measurements.
View measurement charts.
Compare different dates.

Support:

Kilograms and pounds.
Centimeters and inches.

Internally store values in kilograms and centimeters.

Measurements must be optional and nullable.

10. PROGRESS PHOTO MODULE

Users must be able to capture or select progress photos.

Use local device storage.

Photo categories:

Front.
Back.
Left side.
Right side.
Other.

Each photo should include:

Unique ID.
Local file path.
Recording date.
Category.
Optional body weight.
Notes.

Features:

Add photo.
View photo.
Delete photo.
Filter by date.
Compare photos.
Before-and-after comparison.

Store images in private application storage.

Do not upload photos to external services.

Ensure backup and restore include the actual photo files.

11. NUTRITION AND CALORIE TRACKING

Nutrition data will be entered manually.

Do not depend on nutrition APIs or online food databases.

Food database

Allow users to create custom foods.

Each food must contain:

Name.
Serving size.
Serving unit.
Calories.
Protein.
Carbohydrates.
Fat.
Meal categories
Breakfast.
Lunch.
Dinner.
Snacks.
Nutrition logging

Users must be able to:

Add foods to meals.
Change food quantities.
Edit logged meals.
Delete food entries.
Reuse previously created foods.
View daily nutrition totals.

Store a snapshot of nutritional values in every food entry so historical nutrition data does not change when the original food is edited.

Nutrition calculations

Calculate:

Total daily calories.
Total protein.
Total carbohydrates.
Total fats.
Meal-level calories.
Daily goal progress.

Allow users to define daily calorie and macronutrient goals.

Do not automatically assume calorie goals are medically appropriate.

12. WATER TRACKING

Implement a simple water tracker.

Features:

Add water intake.
Quick-add buttons.
Custom quantity.
Daily water target.
Daily water progress.
Historical water records.

Store water internally in milliliters.

13. PROGRESS ANALYTICS

Use Victory Native or another compatible native charting library.

Implement the following charts.

Strength analytics
Exercise weight progression.
Estimated one-rep maximum.
Best repetitions.
Training volume.
Weekly exercise performance.
Body analytics
Body weight trend.
Body fat trend.
Chest measurement.
Waist measurement.
Arm measurement.
Other measurements.
Training analytics
Weekly workout frequency.
Monthly workout frequency.
Training volume by week.
Muscle group distribution.
Total training time.
Nutrition analytics
Daily calorie intake.
Protein trends.
Carbohydrate trends.
Fat trends.
Weekly calorie averages.

Filters:

7 days.
30 days.
90 days.
6 months.
1 year.
All time.

Charts must use real SQLite data, never hardcoded demonstration data.

Provide proper empty states when data is unavailable.

14. PERSONAL RECORDS

Automatically detect personal records from completed workout sets.

Supported records:

Maximum weight.
Maximum repetitions.
Estimated one-rep maximum.
Highest set volume.
Best exercise performance.

Use the Epley estimation formula where appropriate:

Estimated 1RM = Weight × (1 + Reps / 30)

Clearly label estimated records as estimates.

Store the source workout set and achievement date.

Recalculate affected records when historical sets are edited or deleted.

Avoid treating warm-up sets as normal strength records.

15. DATABASE ARCHITECTURE

Use SQLite with Drizzle ORM.

Create a normalized relational database.

Required database tables
User and preferences
user_profile
app_settings
daily_goals
Exercise library
exercises
Workout management
workout_sessions
workout_exercises
workout_sets
workout_notes
Workout planning
workout_plans
plan_days
plan_exercises
Body tracking
body_measurements
progress_photos
Personal records
personal_records
Nutrition
foods
nutrition_entries
Water tracking
water_logs
Backup management
backup_metadata
Database requirements
Use UUIDs or equivalent stable IDs.
Define foreign keys.
Add appropriate indexes.
Use database transactions.
Preserve historical records.
Implement schema migrations.
Validate all user input.
Handle database errors.
Use nullable fields for optional measurements.
Use integer timestamps consistently.
Enable SQLite foreign-key enforcement.
Avoid duplicate records.

All database operations must happen locally.

Do not introduce remote database providers.

16. APPLICATION ARCHITECTURE

Use feature-based architecture.

Suggested structure:

gym-tracker/

app/
_layout.tsx
index.tsx
(tabs)/
_layout.tsx
index.tsx
workout.tsx
progress.tsx
nutrition.tsx
profile.tsx
workout/
active.tsx
history.tsx
exercise/
index.tsx
body/
measurements.tsx
plans/
index.tsx
settings/
index.tsx
src/
components/
constants/
database/
client.ts
schema.ts
migrations/
features/
dashboard/
workouts/
exercises/
plans/
measurements/
nutrition/
analytics/
personal-records/
photos/
backup/
hooks/
services/
stores/
theme/
utils/

Use:

Repositories for database access.
Services for business logic.
Zustand for transient UI state.
SQLite for persistent data.
Drizzle for database queries and migrations.
Reusable UI components.

Do not place all business logic inside React components.

17. BACKUP AND RESTORE

This is a critical feature.

The user has selected:

Automatic local backup + manual export.

Automatic backup

Implement:

Automatic local backups.
Backup on important data changes or at safe checkpoints.
Configurable backup frequency.
Backup rotation.
Backup validation.
Restore functionality.

Use private device storage.

Do not depend on cloud services.

Important: background execution on Android and iOS is restricted. Do not promise guaranteed background backups. Use safe foreground checkpoints and app lifecycle events, with best-effort scheduled maintenance.

Manual export

Allow users to export:

Complete application backup.
Workout history.
Body measurements.
Nutrition history.
Personal records.

Supported formats:

JSON.
CSV.
ZIP archive for complete backup with photos.
Restore

Implement:

File selection.
Archive validation.
Schema version validation.
Data integrity checks.
Photo restoration.
Duplicate handling.
Transactional database replacement.
Clear success and error messages.

Never overwrite existing data without user confirmation.

18. DATA PRIVACY AND SECURITY

Requirements:

No user account.
No app lock.
No backend.
No analytics tracking.
No external data transmission.
No cloud dependency.
Private application storage.
Safe database operations.
Secure backup handling.

SQLite is not encrypted by default.

Document this limitation.

If database encryption is introduced, use a properly maintained compatible solution and secure key storage. Do not implement homemade cryptography.

Backups containing personal data should be treated as sensitive files.

19. ERROR HANDLING AND EDGE CASES

Handle the following:

Application closed during workout.
Device restarted during workout.
Duplicate workout submission.
Invalid weight or repetitions.
Empty exercise name.
Missing photo files.
Corrupted backup.
Invalid import data.
Database migration failure.
Insufficient storage.
Notification permission denied.
User changes measurement units.
User edits old workout records.
User deletes an exercise used in historical workouts.

Historical workout records must not become invalid if an exercise is renamed or removed.

Use safe deletion and appropriate referential integrity.

20. PERFORMANCE REQUIREMENTS

The app should remain responsive with:

10,000+ workout sessions.
100,000+ workout sets.
Thousands of nutrition entries.
Hundreds of progress photos.

Requirements:

Paginate large history lists.
Index frequently queried columns.
Avoid unnecessary database reads.
Use efficient chart aggregation.
Avoid loading full-resolution photos unnecessarily.
Use optimized FlatList or FlashList for large lists.
Keep UI responsive during database operations.
21. TESTING REQUIREMENTS

Write automated tests for:

Database
Database initialization.
Record creation.
Record updates.
Record deletion.
Foreign-key constraints.
Database migrations.
Transactions.
Workout
Starting workout.
Adding exercise.
Recording sets.
Editing sets.
Finishing workout.
Workout recovery.
Training volume calculation.
Personal record calculation.
Nutrition
Food creation.
Meal logging.
Quantity calculations.
Macro totals.
Historical nutrition snapshots.
Backup
Backup generation.
Backup validation.
Backup restoration.
Missing photo handling.
Invalid archive handling.
Platform testing

Test on:

Android physical device.
Android emulator.
iPhone simulator.
iOS physical device where available.

Verify that all primary features work in airplane mode.

22. DEVELOPMENT INSTRUCTIONS

Follow these instructions strictly.

First inspect the existing project structure.
Create a complete Expo React Native TypeScript project if one does not exist.
Install compatible dependencies.
Configure Expo Router.
Configure the database.
Implement database schema and migrations.
Build the theme and shared components.
Implement the navigation.
Implement each feature with working database operations.
Implement business logic.
Implement analytics.
Implement backup and restore.
Write automated tests.
Run TypeScript checks.
Run linting.
Fix compilation errors.
Test the application on Android and iOS.
Provide final installation and build instructions.
Important coding rules
Do not use pseudocode in production implementation.
Do not leave important buttons non-functional.
Do not use mock data as real application data.
Do not create screens that only look functional.
Do not skip database operations.
Do not invent package APIs.
Do not use deprecated APIs.
Do not expose secrets.
Do not introduce backend services.
Do not silently discard user data.
Do not claim tests passed unless they were actually executed.

When a feature is not yet implemented, clearly identify it.

23. DELIVERABLES

The completed project must include:

Complete React Native source code.
Complete TypeScript project structure.
Expo configuration.
All required dependencies.
Complete SQLite database schema.
Database migration system.
All navigation screens.
Workout tracking module.
Exercise library.
Workout planning module.
Body measurement module.
Progress photo module.
Nutrition tracking module.
Water tracking module.
Progress analytics.
Personal records.
Rest timer.
Backup and restore.
Automated tests.
Android build instructions.
iOS build instructions.
README.md.
Known limitations documentation.
24. ACCEPTANCE CRITERIA

The application is considered complete only when:

It launches on Android and iOS.
It works without internet.
Users can record workouts.
Users can save individual sets.
Workout history persists after app restart.
Unfinished workouts can be recovered.
Exercise history is available.
Workout plans work.
Body measurements persist.
Progress photos remain locally accessible.
Nutrition entries work.
Calorie and macro totals are calculated correctly.
Charts use actual database records.
Personal records are calculated correctly.
Rest timer functions correctly.
Backup and restore work.
Exported data can be imported.
Database migrations preserve existing data.
No core feature requires a remote server.
Automated tests pass.
25. FINAL INSTRUCTION TO THE AI CODING AGENT

Build the actual Gym Tracker application, not another architecture proposal.

Work incrementally and deliver functional code.

Start by creating the Expo project and establishing the database, theme, navigation, and working dashboard.

Then implement the workout engine, exercise library, plans, body tracking, nutrition, analytics, personal records, photos, timer, and backup system.

After every major milestone:

Run TypeScript checks.
Run linting.
Run relevant tests.
Fix errors.
Verify that previously implemented features still work.

Maintain a README.md and IMPLEMENTATION_STATUS.md throughout development.

If the project is too large to complete in one response, continue in clearly defined development milestones. Never pretend incomplete features are finished.

The final goal is a polished, production-quality Android and iOS fitness application with a premium dark UI, complete local SQLite storage, reliable backup and restore, and zero backend or mandatory internet dependency.

Build it now.