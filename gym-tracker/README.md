# Gym Tracker

An offline-first workout, body and nutrition tracker for Android and iOS, built with
Expo (SDK 58), React Native 0.88, TypeScript, Expo Router, SQLite (expo-sqlite) and Drizzle ORM.

There is no backend, no account and no network dependency. The SQLite database on the
device is the single source of truth.

## Features

| Area | What's there |
| --- | --- |
| Home | Greeting/date, totals, weekly count, streak, today's plan (by weekday schedule or plan rotation), resume banner, 7-day volume chart, calories, water, body weight, quick actions, recent workouts |
| Workout engine | Start empty / from plan day / from a previous workout; rename; add, reorder, remove exercises; sets with type (warm-up, working, drop, failure, other), weight, reps, RPE, completion + timestamp; duplicate previous set; previous-performance and per-set comparison; pause/resume/finish/cancel; notes per session and per exercise; every change persisted immediately (crash/restart safe); transactional, idempotent finish |
| Rest timer | 30/60/90/120/180 s presets + custom, ±15 s, start/pause/resume/reset, auto-start with per-exercise rest suggestion, sound + vibration, local notification when backgrounded; timestamp-based so it stays accurate in the background |
| Exercise library | 75 built-in exercises across 10 muscle groups; search, filter by muscle and equipment, favorites, custom exercises (create/edit/delete → archived if used in history) |
| Plans | Templates: Push/Pull/Legs, Upper/Lower, Bro Split, Full Body; custom plans; days with optional weekday; targets (sets, reps range, rest, weight); reorder; duplicate; delete; starting a plan never modifies it |
| Body | 12 optional measurements, add/edit/delete, history, per-field charts with range filters, compare two dates; kg/lb and cm/in (stored as kg/cm) |
| Photos | Camera or library → copied into private app storage; categories, weight, notes; filter by category/date; detail view; before/after comparison; missing-file placeholder |
| Nutrition | Manual foods, meals (breakfast/lunch/dinner/snacks), quantities in servings or units, edit/delete entries, snapshot of macros per entry, daily and per-meal totals, goal history |
| Water | Quick-add buttons, custom amount, daily target and progress, history (stored in ml) |
| Analytics | Strength (est. 1RM, max weight, best reps, volume per exercise), weekly/monthly frequency, volume, training time, muscle distribution, body trends, calories/macros, weekly calorie averages, monthly reports; 7D/30D/90D/6M/1Y/All filters; empty states; all from SQLite |
| Personal records | Max weight, max reps, estimated 1RM (Epley, labelled as estimate), best set volume, best session volume; warm-ups excluded; stored with source set + date; recalculated when history is edited or deleted |
| Backup & restore | Automatic local backups at safe checkpoints (launch, background, after workout) with daily/weekly/after-workout frequency and rotation; manual backup; verify; ZIP (with photos), JSON and CSV exports via share sheet; restore from file or local backup with validation (format, schema version, checksum, counts, FK integrity), replace or merge (duplicate-safe), photo restoration, safety backup before restore, full rollback on failure |

## Project layout

```
gym-tracker/
  app.json, eas.json, babel.config.js, metro.config.js, drizzle.config.ts, jest.config.js
  assets/sounds/timer-done.wav        generated beep for the rest timer
  src/
    app/                              Expo Router routes (every file is a screen)
      _layout.tsx                     DB bootstrap, migration-failure screen, root stack
      (tabs)/                         Home, Workout, Progress, Nutrition, Profile
      workout/ exercise/ plans/ body/ photos/ nutrition/ records/ reports/ settings/
    components/                       Design-system primitives, charts, option sheet
    constants/                        Exercise library, plan templates, labels
    database/
      schema.ts                       Drizzle schema (18 tables)
      migrations/                     drizzle-kit SQL migrations (bundled into the app)
      client.ts / native.ts / seed.ts DB accessor, expo-sqlite bootstrap, reference data
    features/<feature>/               repository.ts (queries), service.ts (business logic),
                                      calculations.ts (pure), components/, __tests__/
    hooks/ services/ stores/ theme/ utils/
```

Routes live in `src/app/` (the current Expo Router convention) rather than a root `app/`.

Architecture:

- **SQLite is the source of truth.** Services run synchronous Drizzle queries.
  Every write bumps a small Zustand "data version", and `useQuery` re-runs on it.
- **Zustand** holds only transient UI state (the data version and the rest timer).
- **Repositories and services take or obtain an `AppDb`** typed against Drizzle's sync
  SQLite base class. The same code therefore runs on expo-sqlite in the app and on
  better-sqlite3 in tests, with the real migrations.
- **Historical integrity.** Workout exercises snapshot the exercise name and muscle.
  Nutrition entries snapshot food values. Exercises in use are archived, never deleted
  (FK `restrict`). Deleting a plan keeps its sessions (`set null`).

## Getting started

Requirements: Node 20+ (tested with Node 24), and Android Studio and/or Xcode for local
native builds (or an Expo account for EAS cloud builds).

```bash
cd gym-tracker
npm install
```

This app uses native modules that are not all in Expo Go: Skia (charts), notifications,
SQLite and audio. **Use a development build:**

```bash
# Android (emulator or USB device with debugging enabled)
npx expo run:android

# iOS simulator (macOS + Xcode)
npx expo run:ios

# Then start Metro for the dev client
npx expo start --dev-client
```

### Cloud builds with EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # dev client APK
npx eas-cli@latest build --profile development --platform ios        # iOS simulator build
npx eas-cli@latest build --profile development-device --platform ios # iOS device (needs Apple account)
npx eas-cli@latest build --profile preview --platform android        # installable release APK
npx eas-cli@latest build --profile production --platform all         # store builds
```

### Release builds locally

```bash
npx expo run:android --variant release
npx expo run:ios --configuration Release
```

Android release signing and iOS signing must be configured first (EAS can manage the
credentials).

## Quality checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (eslint-config-expo, React hooks rules)
npm test            # jest: logic (Node + real SQLite) and ui (jest-expo + RNTL) projects
npx expo-doctor     # dependency / config health
```

The **logic** test project runs the real Drizzle migrations on in-memory better-sqlite3. It
covers DB init, CRUD, FK constraints, transactions, migrations, the workout engine,
recovery, volume and PR calculations, nutrition snapshots and totals, plans, exercises, and
backup generation, validation, restore and rollback, CSV, plus a 100k-set performance test.
The **ui** project tests shared components.

## Database migrations

1. Change `src/database/schema.ts`.
2. Run `npm run db:generate -- --name <change>`. This writes a new SQL file and updates
   `migrations/meta` and `migrations/migrations.js`.
3. Review the SQL. Drizzle cannot express everything, e.g. expression indexes.
4. Ship. On launch, pending migrations run before the UI loads. If one fails, it is rolled
   back and the user sees a recovery screen (retry, or save the raw database file).
   Data is never deleted.

The schema version is the number of migrations. Backups record it, and a backup from a
newer schema is refused rather than partially restored.

## Data and privacy

- No accounts, analytics, tracking or network calls. Data leaves the device only when
  the user exports or shares a file.
- Database: `gym-tracker.db` in the app's private SQLite directory. Photos:
  `<documents>/photos/`. Local backups: `<documents>/backups/`.
- **SQLite and backups are not encrypted.** See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md#known-limitations).

## Units

Stored internally as kg, cm, ml and epoch-millisecond integer timestamps. Unit
preferences only affect display and input, so switching units never changes stored data.
