import type { Equipment, ExerciseType, MuscleGroup } from '@/database/schema';

export interface LibraryExercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  exerciseType: ExerciseType;
  instructions: string;
}

type Row = [string, string, MuscleGroup, MuscleGroup[], Equipment, ExerciseType, string];

/** Built-in exercise library (reference data, available fully offline). IDs are stable forever. */
const ROWS: Row[] = [
  // Chest
  ['ex_bench_press', 'Barbell Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell', 'strength', 'Lie on the bench with eyes under the bar. Grip slightly wider than shoulders, retract shoulder blades, lower the bar to mid-chest under control, then press back up to lockout.'],
  ['ex_incline_bench', 'Incline Barbell Bench Press', 'chest', ['shoulders', 'triceps'], 'barbell', 'strength', 'Set the bench to 30–45°. Lower the bar to the upper chest, keeping elbows slightly tucked, then press up and slightly back.'],
  ['ex_db_bench', 'Dumbbell Bench Press', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'strength', 'Press dumbbells from chest level to above the shoulders. Lower slowly until a stretch is felt in the chest.'],
  ['ex_incline_db_press', 'Incline Dumbbell Press', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'strength', 'On an incline bench, press dumbbells up over the upper chest and lower with control.'],
  ['ex_db_fly', 'Dumbbell Fly', 'chest', ['shoulders'], 'dumbbell', 'strength', 'With a slight bend in the elbows, open the arms wide until a chest stretch is felt, then bring the dumbbells together over the chest.'],
  ['ex_cable_fly', 'Cable Crossover', 'chest', ['shoulders'], 'cable', 'strength', 'From high pulleys, bring handles down and together in front of the hips, squeezing the chest. Return slowly.'],
  ['ex_pec_deck', 'Pec Deck Machine', 'chest', [], 'machine', 'strength', 'Sit upright, bring the pads together in front of the chest, pause, and return under control.'],
  ['ex_chest_press_machine', 'Machine Chest Press', 'chest', ['triceps'], 'machine', 'strength', 'Adjust the seat so handles are at mid-chest. Press forward to near lockout and return slowly.'],
  ['ex_push_up', 'Push-Up', 'chest', ['triceps', 'shoulders', 'abs'], 'bodyweight', 'bodyweight', 'Hands under shoulders, body in a straight line. Lower the chest to just above the floor and push back up.'],
  ['ex_dips_chest', 'Chest Dip', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'bodyweight', 'Lean the torso forward on parallel bars, lower until the shoulders are slightly below the elbows, then press up.'],
  // Back
  ['ex_deadlift', 'Conventional Deadlift', 'back', ['legs', 'glutes'], 'barbell', 'strength', 'Bar over mid-foot, hinge to grip it, brace the core, and drive through the floor keeping the bar close until standing tall. Lower with control.'],
  ['ex_pull_up', 'Pull-Up', 'back', ['biceps'], 'bodyweight', 'bodyweight', 'Hang from a bar with an overhand grip. Pull until the chin clears the bar, then lower fully.'],
  ['ex_chin_up', 'Chin-Up', 'back', ['biceps'], 'bodyweight', 'bodyweight', 'Underhand grip shoulder-width apart. Pull the chest toward the bar and lower under control.'],
  ['ex_lat_pulldown', 'Lat Pulldown', 'back', ['biceps'], 'cable', 'strength', 'Grip the bar wider than shoulders, pull it to the upper chest while driving elbows down, then return slowly.'],
  ['ex_barbell_row', 'Barbell Row', 'back', ['biceps', 'shoulders'], 'barbell', 'strength', 'Hinge to roughly 45°, pull the bar to the lower ribs, squeeze the shoulder blades, and lower with control.'],
  ['ex_db_row', 'One-Arm Dumbbell Row', 'back', ['biceps'], 'dumbbell', 'strength', 'Support one hand on a bench, row the dumbbell toward the hip, and lower until the arm is straight.'],
  ['ex_seated_cable_row', 'Seated Cable Row', 'back', ['biceps'], 'cable', 'strength', 'Sit tall, pull the handle to the abdomen, squeeze the back, and extend the arms slowly.'],
  ['ex_tbar_row', 'T-Bar Row', 'back', ['biceps'], 'barbell', 'strength', 'Straddle the bar, hinge forward, and row the handle to the chest keeping the back flat.'],
  ['ex_face_pull', 'Face Pull', 'shoulders', ['back'], 'cable', 'strength', 'With a rope at face height, pull toward the forehead with elbows high, rotating hands outward.'],
  ['ex_back_extension', 'Back Extension', 'back', ['glutes'], 'bodyweight', 'bodyweight', 'On a hyperextension bench, lower the torso by hinging at the hips and raise back to a neutral line.'],
  ['ex_straight_arm_pulldown', 'Straight-Arm Pulldown', 'back', [], 'cable', 'strength', 'With straight arms, sweep the bar from eye level down to the thighs using the lats.'],
  // Shoulders
  ['ex_ohp', 'Overhead Press', 'shoulders', ['triceps'], 'barbell', 'strength', 'Standing, press the bar from the front of the shoulders to overhead lockout, moving the head through at the top.'],
  ['ex_db_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', ['triceps'], 'dumbbell', 'strength', 'Seated or standing, press dumbbells from shoulder level to overhead and lower with control.'],
  ['ex_lateral_raise', 'Lateral Raise', 'shoulders', [], 'dumbbell', 'strength', 'Raise dumbbells out to the sides to shoulder height with a slight elbow bend, then lower slowly.'],
  ['ex_cable_lateral_raise', 'Cable Lateral Raise', 'shoulders', [], 'cable', 'strength', 'Using a low pulley, raise the handle out to the side to shoulder height.'],
  ['ex_rear_delt_fly', 'Rear Delt Fly', 'shoulders', ['back'], 'dumbbell', 'strength', 'Hinge forward and raise the dumbbells out to the sides, leading with the elbows.'],
  ['ex_front_raise', 'Front Raise', 'shoulders', [], 'dumbbell', 'strength', 'Raise dumbbells in front of you to shoulder height and lower under control.'],
  ['ex_arnold_press', 'Arnold Press', 'shoulders', ['triceps'], 'dumbbell', 'strength', 'Start with palms facing you, rotate the palms forward while pressing overhead.'],
  ['ex_upright_row', 'Upright Row', 'shoulders', ['back'], 'ez_bar', 'strength', 'Pull the bar up along the body to chest height, elbows leading.'],
  ['ex_shrug', 'Barbell Shrug', 'back', ['shoulders'], 'barbell', 'strength', 'Hold the bar at arm’s length and elevate the shoulders toward the ears, pause, and lower.'],
  // Biceps
  ['ex_barbell_curl', 'Barbell Curl', 'biceps', [], 'barbell', 'strength', 'Curl the bar toward the shoulders keeping elbows at your sides, then lower fully.'],
  ['ex_db_curl', 'Dumbbell Curl', 'biceps', [], 'dumbbell', 'strength', 'Curl dumbbells with palms up, squeeze at the top, and lower slowly.'],
  ['ex_hammer_curl', 'Hammer Curl', 'biceps', [], 'dumbbell', 'strength', 'Curl with a neutral (palms facing in) grip, keeping the elbows still.'],
  ['ex_preacher_curl', 'Preacher Curl', 'biceps', [], 'ez_bar', 'strength', 'With upper arms on the preacher pad, curl the bar up and lower until arms are nearly straight.'],
  ['ex_cable_curl', 'Cable Curl', 'biceps', [], 'cable', 'strength', 'From a low pulley, curl the bar toward the shoulders and lower under tension.'],
  ['ex_incline_db_curl', 'Incline Dumbbell Curl', 'biceps', [], 'dumbbell', 'strength', 'Lying back on an incline bench, curl with arms hanging behind the torso for a long stretch.'],
  // Triceps
  ['ex_tricep_pushdown', 'Triceps Pushdown', 'triceps', [], 'cable', 'strength', 'With elbows pinned at your sides, push the bar or rope down to full extension.'],
  ['ex_overhead_tricep_ext', 'Overhead Triceps Extension', 'triceps', [], 'dumbbell', 'strength', 'Hold a dumbbell overhead with both hands, lower it behind the head, and extend back up.'],
  ['ex_skull_crusher', 'Skull Crusher', 'triceps', [], 'ez_bar', 'strength', 'Lying on a bench, lower the bar toward the forehead by bending the elbows, then extend.'],
  ['ex_close_grip_bench', 'Close-Grip Bench Press', 'triceps', ['chest', 'shoulders'], 'barbell', 'strength', 'Bench press with hands about shoulder-width apart, elbows tucked close to the body.'],
  ['ex_dips_triceps', 'Triceps Dip', 'triceps', ['chest', 'shoulders'], 'bodyweight', 'bodyweight', 'Keep the torso upright on parallel bars, lower until elbows reach about 90°, and press up.'],
  ['ex_bench_dip', 'Bench Dip', 'triceps', ['shoulders'], 'bodyweight', 'bodyweight', 'Hands on a bench behind you, lower the hips by bending the elbows, then push back up.'],
  // Legs
  ['ex_back_squat', 'Barbell Back Squat', 'legs', ['glutes', 'abs'], 'barbell', 'strength', 'Bar on the upper back, feet shoulder-width. Brace, sit down between the hips until thighs are at least parallel, then drive up.'],
  ['ex_front_squat', 'Front Squat', 'legs', ['glutes', 'abs'], 'barbell', 'strength', 'Bar resting on the front delts, elbows high. Squat down keeping the torso upright.'],
  ['ex_leg_press', 'Leg Press', 'legs', ['glutes'], 'machine', 'strength', 'Feet shoulder-width on the platform, lower until knees reach about 90°, then press without locking out hard.'],
  ['ex_romanian_deadlift', 'Romanian Deadlift', 'legs', ['glutes', 'back'], 'barbell', 'strength', 'With soft knees, hinge at the hips sliding the bar down the thighs until a hamstring stretch, then stand up.'],
  ['ex_leg_extension', 'Leg Extension', 'legs', [], 'machine', 'strength', 'Extend the knees to straighten the legs, pause, and lower slowly.'],
  ['ex_leg_curl', 'Lying Leg Curl', 'legs', [], 'machine', 'strength', 'Curl the pad toward the glutes, squeeze the hamstrings, and lower under control.'],
  ['ex_seated_leg_curl', 'Seated Leg Curl', 'legs', [], 'machine', 'strength', 'Seated with the pad above the ankles, curl down and back, then return slowly.'],
  ['ex_bulgarian_split_squat', 'Bulgarian Split Squat', 'legs', ['glutes'], 'dumbbell', 'strength', 'Rear foot elevated on a bench, lower the back knee toward the floor and drive up through the front foot.'],
  ['ex_walking_lunge', 'Walking Lunge', 'legs', ['glutes'], 'dumbbell', 'strength', 'Step forward into a lunge, lower the back knee near the floor, then step through into the next rep.'],
  ['ex_goblet_squat', 'Goblet Squat', 'legs', ['glutes'], 'dumbbell', 'strength', 'Hold a dumbbell at the chest and squat down between the knees, keeping the chest up.'],
  ['ex_hack_squat', 'Hack Squat', 'legs', ['glutes'], 'machine', 'strength', 'Shoulders under the pads, lower until thighs are parallel, and press back up.'],
  ['ex_standing_calf_raise', 'Standing Calf Raise', 'legs', [], 'machine', 'strength', 'Rise onto the balls of the feet as high as possible, pause, and lower into a full stretch.'],
  ['ex_seated_calf_raise', 'Seated Calf Raise', 'legs', [], 'machine', 'strength', 'With knees under the pad, raise the heels as high as possible and lower slowly.'],
  // Glutes
  ['ex_hip_thrust', 'Barbell Hip Thrust', 'glutes', ['legs'], 'barbell', 'strength', 'Upper back on a bench, bar over the hips. Drive hips up until the torso is parallel to the floor, squeeze, and lower.'],
  ['ex_glute_bridge', 'Glute Bridge', 'glutes', ['legs'], 'bodyweight', 'bodyweight', 'Lying on your back with knees bent, drive the hips up and squeeze the glutes at the top.'],
  ['ex_cable_kickback', 'Cable Glute Kickback', 'glutes', [], 'cable', 'strength', 'With an ankle strap, kick the leg back and up while keeping the torso still.'],
  ['ex_hip_abduction', 'Hip Abduction Machine', 'glutes', [], 'machine', 'strength', 'Push the pads outward with the knees, pause, and return slowly.'],
  ['ex_sumo_deadlift', 'Sumo Deadlift', 'glutes', ['legs', 'back'], 'barbell', 'strength', 'Wide stance with toes out, grip inside the knees, and drive the floor apart to stand up.'],
  // Abs
  ['ex_plank', 'Plank', 'abs', ['shoulders'], 'bodyweight', 'bodyweight', 'Hold a straight line from head to heels on the forearms. Log the hold time in seconds as reps.'],
  ['ex_crunch', 'Crunch', 'abs', [], 'bodyweight', 'bodyweight', 'Lying on your back, curl the shoulders toward the hips and lower slowly.'],
  ['ex_hanging_leg_raise', 'Hanging Leg Raise', 'abs', [], 'bodyweight', 'bodyweight', 'Hang from a bar and raise the legs to hip height or above without swinging.'],
  ['ex_cable_crunch', 'Cable Crunch', 'abs', [], 'cable', 'strength', 'Kneeling with a rope behind the head, crunch the ribs toward the hips.'],
  ['ex_russian_twist', 'Russian Twist', 'abs', [], 'bodyweight', 'bodyweight', 'Seated with feet off the floor, rotate the torso side to side.'],
  ['ex_ab_wheel', 'Ab Wheel Rollout', 'abs', ['shoulders'], 'other', 'bodyweight', 'From the knees, roll the wheel forward as far as you can control, then pull back.'],
  // Cardio
  ['ex_treadmill', 'Treadmill Run', 'cardio', ['legs'], 'cardio_machine', 'cardio', 'Run or walk at a steady pace. Log minutes as reps.'],
  ['ex_rowing_machine', 'Rowing Machine', 'cardio', ['back', 'legs'], 'cardio_machine', 'cardio', 'Drive with the legs, then lean back and pull the handle to the ribs. Log minutes as reps.'],
  ['ex_stationary_bike', 'Stationary Bike', 'cardio', ['legs'], 'cardio_machine', 'cardio', 'Cycle at the chosen resistance. Log minutes as reps.'],
  ['ex_jump_rope', 'Jump Rope', 'cardio', ['legs'], 'other', 'cardio', 'Jump continuously with small hops. Log minutes or rounds as reps.'],
  ['ex_stair_climber', 'Stair Climber', 'cardio', ['legs', 'glutes'], 'cardio_machine', 'cardio', 'Climb at a steady pace without leaning on the rails. Log minutes as reps.'],
  // Full body
  ['ex_burpee', 'Burpee', 'full_body', ['chest', 'legs'], 'bodyweight', 'bodyweight', 'Squat, kick the feet back to a plank, return, and jump up explosively.'],
  ['ex_kb_swing', 'Kettlebell Swing', 'full_body', ['glutes', 'legs', 'back'], 'kettlebell', 'strength', 'Hinge and snap the hips forward to swing the kettlebell to chest height.'],
  ['ex_clean_press', 'Clean and Press', 'full_body', ['shoulders', 'legs'], 'barbell', 'strength', 'Pull the bar from the floor to the shoulders in one motion, then press overhead.'],
  ['ex_thruster', 'Thruster', 'full_body', ['legs', 'shoulders'], 'dumbbell', 'strength', 'Front squat, then use the drive out of the bottom to press the weights overhead.'],
  ['ex_farmers_walk', 'Farmer’s Walk', 'full_body', ['back', 'abs'], 'dumbbell', 'strength', 'Carry heavy weights at your sides and walk with an upright posture. Log distance or seconds as reps.'],
];

export const EXERCISE_LIBRARY: LibraryExercise[] = ROWS.map(
  ([id, name, primaryMuscle, secondaryMuscles, equipment, exerciseType, instructions]) => ({
    id,
    name,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    exerciseType,
    instructions,
  }),
);
