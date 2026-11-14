# Implementation Status

Last updated: 2026-11-12 · App version 1.0.0 · Database schema v1

Legend: ✅ implemented and covered by automated tests · 🟢 implemented, needs on-device check
· ⚠️ partial or limited · ❌ not implemented

## Verification performed

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ passes, 0 errors |
| `expo lint` | ✅ passes, 0 errors, 0 warnings |
| `jest` (logic + ui projects) | ✅ 65 tests in 10 suites pass |
| `expo-doctor` | ✅ 20/20 checks |
| `expo export` Android + iOS | ✅ both bundles build (Hermes bytecode); migration SQL is embedded |
| `expo prebuild` | ✅ native projects generate; permissions and usage strings applied (generated dirs removed again, as CNG intends) |
| Run on Android emulator / device | ❌ **not done**: no device or emulator in the build environment |
| Run on iOS simulator / device | ❌ **not done**: requires macOS + Xcode |
| Airplane-mode check | ❌ **not done on device**. The code makes no network calls; check it on device |

Everything marked 🟢 compiles, bundles and has its business logic tested. The screens
themselves have not been driven on a real device yet, so treat the first device session
as acceptance testing.

## Feature checklist

### Foundation
- ✅ Expo SDK 58 + TypeScript + Expo Router, five bottom tabs
- ✅ SQLite (expo-sqlite) + Drizzle ORM, 18 normalized tables, UUID keys, FKs enforced, indexes, integer timestamps
- ✅ Drizzle migrations bundled and applied at launch; failure → recovery screen (retry / save raw DB)
- ✅ Idempotent seeding: 75 exercises, 4 plan templates, default settings
- 🟢 Design system: tokens (spec palette), shared components, dark theme, accessibility roles/labels

### Workout tracking
- ✅ Start empty / from plan day / from previous workout; custom name; single active workout guard
- ✅ Add, reorder, remove exercises; add, edit, delete, duplicate sets; set types; RPE; completion timestamp
- ✅ Previous performance and per-set comparison
- ✅ Pause / resume / finish / cancel; notes (session and exercise)
- ✅ Recovery after kill/restart (all state in SQLite, resume banner on Home and Workout tabs)
- ✅ Transactional, idempotent finish (duplicate taps are no-ops); incomplete sets discarded with a warning
- ✅ Volume, sets, reps, duration (excluding pauses), exercise count, muscle distribution
- ✅ Editing or deleting historical workouts recalculates records

### Rest timer
- 🟢 Presets 30/60/90/120/180 s, custom, ±15 s, start/pause/resume/reset, auto-start using the exercise's rest time
- 🟢 Sound (bundled WAV via expo-audio), vibration, local notification when backgrounded
- 🟢 Timestamp-based, accurate after backgrounding
- ⚠️ Timer state is in memory. If the OS kills the app mid-rest, the scheduled notification still fires but the countdown UI is gone on reopen

### Exercise library
- ✅ Search, filter by muscle/equipment, favorites, custom create/edit/delete (archived if referenced)
- 🟢 "How to perform" on every built-in exercise: looping animated anatomical figure with the worked muscles highlighted (primary and secondary, 14 muscle groups; Reanimated + SVG, offline, play/pause, slow motion, respects Reduce Motion) plus setup, steps, breathing, form cues, common mistakes and safety notes. Content lives in `src/features/exercise-guide/`. Custom exercises keep their free-text instructions

### Plans
- ✅ Create, edit, duplicate, delete, start; days, weekday schedule, order, targets (sets, rep range, rest, weight)
- ✅ Starting a workout never modifies the plan; deleting a plan keeps history

### Body, photos
- ✅ 12 optional measurements, CRUD, validation, unit conversion (stored kg/cm)
- 🟢 Charts per measurement, compare two dates
- 🟢 Photos: camera/library → private storage, categories, weight, notes, filter, view, delete, before/after compare
- ⚠️ No separate thumbnail files. expo-image downsamples to view size, so full-resolution bitmaps aren't held in memory, but originals are decoded on each display

### Nutrition and water
- ✅ Manual foods, meal logging, quantities, edit/delete entries, per-entry macro snapshots, daily and meal totals
- ✅ Goal history (goals apply from the day they're set); no automatic or "recommended" goals
- ✅ Water: quick add, custom, target, daily history (ml)

### Analytics and records
- ✅ Aggregations from SQLite (session stats, buckets, muscle distribution, exercise progress, nutrition daily, weekly averages, monthly report)
- 🟢 Charts (Victory Native XL / Skia) with 7D–All filters and empty states
- ✅ PRs: max weight, max reps, est. 1RM (Epley, labelled), best set volume, best session volume; warm-ups excluded; source set and date stored

### Backup and restore
- ✅ ZIP (manifest + data + photos), JSON export, CSV exports (workouts, measurements, nutrition, records)
- ✅ Validation: format, format version, schema version, checksum, record counts, duplicate IDs, photo presence, FK integrity
- ✅ Restore: replace or merge (duplicate-safe), photo restoration, single transaction, rollback including written photos
- ✅ Missing photo files are reported in the manifest instead of failing the backup
- 🟢 Automatic local backups at launch / background / after workout; daily, weekly, after-workout; rotation; verify; share; delete
- 🟢 Safety backup before any restore; explicit confirmation before overwrite

### Performance
- ✅ Tested with 10,000 sessions / 100,000 sets in Node. Times measured on a desktop CPU; expect phones to be several times slower:
  history page 4 ms, dashboard 11 ms, all-time stats 73 ms, PR recalculation 73 ms
- 🟢 Keyset/limit pagination for history and measurements, FlatList virtualization, SQL aggregation

## Known limitations

1. **No encryption.** The SQLite database, photos and backup files are stored unencrypted in
   the app sandbox. Platform sandboxing and the device lock screen are the only protection.
   Exported files can be read by anyone who obtains them. If encryption is added later,
   use a maintained solution (for example SQLCipher through expo-sqlite's `useSQLCipher`
   config) with keys in expo-secure-store. Never use homemade crypto.
2. **Automatic backups are best effort.** They run at foreground checkpoints (launch,
   moving to background, after finishing a workout). No background task is registered,
   because iOS and Android do not guarantee background execution. Backups don't happen
   while the app is unused.
3. **Local backups stay on the device.** Uninstalling the app or losing the device loses
   them. Users should export a full ZIP regularly. Automatic backups contain data only;
   photos are included in manual full backups.
4. **Backup checksum is FNV-1a.** It detects corruption and truncation, not deliberate
   tampering.
5. **Large restores run on the JS thread** in one transaction. Very large backups can
   freeze the UI for several seconds while restoring (a busy indicator is shown).
6. **Photo thumbnails:** see Photos above.
7. **Rest timer state** is not persisted across process death; see Rest timer above.
8. **CSV is export-only.** The JSON and ZIP exports can be imported.
9. **iOS 26 Liquid Glass headers:** headers set an explicit background, so they render
   opaque. This is intentional, for the custom dark theme.
10. **On-device verification is outstanding.** See the table at the top.

## Suggested next steps

1. Build a dev client (`npx expo run:android`, or `eas build --profile development`) and
   walk through the acceptance criteria on a physical Android device, an emulator and the
   iOS simulator, including airplane mode and force-quit during a workout.
2. Add end-to-end tests (Maestro or Detox) for the main flows once a device is available.
3. Consider a background-task-based backup with expo-background-task, still best effort.
4. Generate thumbnails for photos (for example expo-image-manipulator) if very large
   libraries feel slow.
