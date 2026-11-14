import { MUSCLES, type Muscle, type MuscleTargets } from './drawing';
import type { PatternId } from './patterns';

/** Step-by-step coaching content for a built-in exercise. */
export interface ExerciseGuide {
  /** Animated movement shown above the steps. */
  pattern: PatternId;
  /** Getting into the start position. */
  setup: string[];
  /** One repetition, in order. */
  steps: string[];
  breathing: string;
  /** Short form cues to keep in mind during the set. */
  cues: string[];
  mistakes: string[];
  safety?: string;
  /** Muscles lit up on the figure. */
  muscles: MuscleTargets;
}

type GuideContent = Omit<ExerciseGuide, 'muscles'>;

const BRACE = 'Breathe in and brace your core before each rep, hold it through the hardest part, and breathe out as you finish the rep.';
const EXHALE_ON_EFFORT = 'Breathe in on the way down (the easy part), breathe out as you push or pull (the hard part).';
const STEADY = 'Breathe steadily and rhythmically. Never hold your breath for long stretches.';

/**
 * Worked muscles per exercise: "primary muscles | secondary muscles".
 * Names are the anatomical groups the figure can highlight (see MUSCLES).
 */
const MUSCLE_MAP: Record<string, string> = {
  ex_bench_press: 'pecs | triceps delts',
  ex_incline_bench: 'pecs delts | triceps',
  ex_db_bench: 'pecs | triceps delts',
  ex_incline_db_press: 'pecs delts | triceps',
  ex_db_fly: 'pecs | delts',
  ex_cable_fly: 'pecs | delts',
  ex_pec_deck: 'pecs | delts',
  ex_chest_press_machine: 'pecs | triceps delts',
  ex_push_up: 'pecs triceps | delts abs',
  ex_dips_chest: 'pecs triceps | delts',
  ex_deadlift: 'glutes hamstrings lowerBack | quads traps lats forearms',
  ex_pull_up: 'lats biceps | forearms traps',
  ex_chin_up: 'lats biceps | forearms',
  ex_lat_pulldown: 'lats | biceps',
  ex_barbell_row: 'lats traps | biceps lowerBack delts',
  ex_db_row: 'lats | biceps traps',
  ex_seated_cable_row: 'lats traps | biceps',
  ex_tbar_row: 'lats traps | biceps lowerBack',
  ex_face_pull: 'delts traps | biceps',
  ex_back_extension: 'lowerBack glutes | hamstrings',
  ex_straight_arm_pulldown: 'lats | triceps',
  ex_ohp: 'delts triceps | traps abs',
  ex_db_shoulder_press: 'delts | triceps traps',
  ex_lateral_raise: 'delts | traps',
  ex_cable_lateral_raise: 'delts | traps',
  ex_rear_delt_fly: 'delts traps | lats',
  ex_front_raise: 'delts | pecs',
  ex_arnold_press: 'delts | triceps',
  ex_upright_row: 'delts traps | biceps',
  ex_shrug: 'traps | forearms',
  ex_barbell_curl: 'biceps | forearms',
  ex_db_curl: 'biceps | forearms',
  ex_hammer_curl: 'biceps forearms |',
  ex_preacher_curl: 'biceps | forearms',
  ex_cable_curl: 'biceps | forearms',
  ex_incline_db_curl: 'biceps | forearms',
  ex_tricep_pushdown: 'triceps |',
  ex_overhead_tricep_ext: 'triceps |',
  ex_skull_crusher: 'triceps |',
  ex_close_grip_bench: 'triceps pecs | delts',
  ex_dips_triceps: 'triceps | pecs delts',
  ex_bench_dip: 'triceps | delts pecs',
  ex_back_squat: 'quads glutes | hamstrings lowerBack abs',
  ex_front_squat: 'quads | glutes abs',
  ex_leg_press: 'quads glutes | hamstrings',
  ex_romanian_deadlift: 'hamstrings glutes | lowerBack forearms',
  ex_leg_extension: 'quads |',
  ex_leg_curl: 'hamstrings | calves',
  ex_seated_leg_curl: 'hamstrings |',
  ex_bulgarian_split_squat: 'quads glutes | hamstrings',
  ex_walking_lunge: 'quads glutes | hamstrings calves',
  ex_goblet_squat: 'quads glutes | abs',
  ex_hack_squat: 'quads | glutes',
  ex_standing_calf_raise: 'calves |',
  ex_seated_calf_raise: 'calves |',
  ex_hip_thrust: 'glutes | hamstrings quads',
  ex_glute_bridge: 'glutes | hamstrings',
  ex_cable_kickback: 'glutes | hamstrings',
  ex_hip_abduction: 'glutes |',
  ex_sumo_deadlift: 'glutes quads | hamstrings lowerBack traps',
  ex_plank: 'abs | obliques delts',
  ex_crunch: 'abs |',
  ex_hanging_leg_raise: 'abs | obliques forearms',
  ex_cable_crunch: 'abs | obliques',
  ex_russian_twist: 'obliques | abs',
  ex_ab_wheel: 'abs | lats delts',
  ex_treadmill: 'quads calves | hamstrings glutes',
  ex_rowing_machine: 'lats quads | hamstrings glutes biceps',
  ex_stationary_bike: 'quads | calves hamstrings',
  ex_jump_rope: 'calves | quads delts',
  ex_stair_climber: 'glutes quads | calves',
  ex_burpee: 'quads pecs | delts triceps abs',
  ex_kb_swing: 'glutes hamstrings | lowerBack delts',
  ex_clean_press: 'delts glutes quads | traps triceps',
  ex_thruster: 'quads delts | glutes triceps',
  ex_farmers_walk: 'forearms traps | abs',
};

function parseMuscles(id: string): MuscleTargets {
  const [p = '', s = ''] = (MUSCLE_MAP[id] ?? '').split('|');
  const list = (x: string) => x.split(/\s+/).filter(Boolean) as Muscle[];
  for (const m of [...list(p), ...list(s)]) {
    if (!MUSCLES.includes(m)) throw new Error(`Unknown muscle "${m}" for ${id}`);
  }
  return { primary: list(p), secondary: list(s) };
}

const GUIDE_CONTENT: Record<string, GuideContent> = {
  // ---------------------------------------------------------------- Chest
  ex_bench_press: {
    pattern: 'benchPress',
    setup: [
      'Lie on the bench with your eyes directly under the bar.',
      'Grip the bar slightly wider than shoulder-width, wrists stacked over the elbows.',
      'Pinch your shoulder blades together and down, keep a small arch in your upper back, and plant your feet flat.',
      'Unrack the bar and hold it over your shoulders with straight arms.',
    ],
    steps: [
      'Lower the bar under control to your mid-chest (around nipple line).',
      'Keep your elbows about 45–70° from your body, not flared straight out.',
      'Touch your chest lightly without bouncing.',
      'Press the bar back up and slightly toward your face until your arms are straight.',
    ],
    breathing: BRACE,
    cues: ['Shoulder blades stay pinned to the bench', 'Drive your feet into the floor', 'Bar moves in a slight arc, not straight up and down'],
    mistakes: ['Bouncing the bar off the chest', 'Lifting the hips off the bench', 'Flaring elbows to 90°, which stresses the shoulders'],
    safety: 'Use a spotter or safety arms on heavy sets. Never wrap your thumbs around the same side as your fingers (no "suicide grip").',
  },
  ex_incline_bench: {
    pattern: 'inclinePress',
    setup: [
      'Set the bench to 30–45°.',
      'Sit back with your eyes under the bar and your feet flat.',
      'Grip slightly wider than shoulder-width and pinch your shoulder blades back.',
      'Unrack and hold the bar over your upper chest with straight arms.',
    ],
    steps: [
      'Lower the bar to your upper chest, just below the collarbones.',
      'Keep your elbows slightly tucked, below the bar.',
      'Press up and slightly back until the bar is over your shoulders.',
    ],
    breathing: BRACE,
    cues: ['Keep your back and head on the pad', 'Wrists straight, bar over forearms'],
    mistakes: ['Setting the bench too steep (it becomes a shoulder press)', 'Lowering the bar to the mid-chest instead of the upper chest'],
    safety: 'Use safety arms or a spotter when pressing heavy.',
  },
  ex_db_bench: {
    pattern: 'benchPressDb',
    setup: [
      'Sit on the end of a flat bench with dumbbells on your thighs.',
      'Lie back and use your knees to help bring the dumbbells to your chest.',
      'Hold them at chest level, palms facing your feet, shoulder blades squeezed together.',
    ],
    steps: [
      'Press both dumbbells up until your arms are straight over your shoulders.',
      'Lower slowly until you feel a stretch in your chest, elbows slightly below the bench line.',
      'Press back up, letting the dumbbells come slightly toward each other at the top.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows at about 45° from your body', 'Control the weights, both sides at the same speed'],
    mistakes: ['Lowering too far and losing shoulder position', 'Clanging the dumbbells together at the top'],
    safety: 'To finish, bring the dumbbells to your chest and sit up with them on your thighs. Don’t drop them out to the sides.',
  },
  ex_incline_db_press: {
    pattern: 'inclinePressDb',
    setup: [
      'Set the bench to 30–45° and sit back with dumbbells on your thighs.',
      'Kick the dumbbells up to your shoulders as you lean back.',
      'Hold them beside your upper chest, palms forward.',
    ],
    steps: [
      'Press the dumbbells up over your upper chest.',
      'Lower with control until your elbows are just below your shoulders.',
      'Press back up.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Keep your shoulder blades back', 'Press over the upper chest, not the face'],
    mistakes: ['Arching off the bench to make it a flat press', 'Going too heavy to control the bottom'],
  },
  ex_db_fly: {
    pattern: 'dbFly',
    setup: [
      'Lie on a flat bench holding dumbbells above your chest, palms facing each other.',
      'Bend your elbows slightly and keep that bend for the whole set.',
    ],
    steps: [
      'Open your arms wide in an arc, lowering the dumbbells out to the sides.',
      'Stop when you feel a stretch across your chest and your elbows are around bench height.',
      'Squeeze your chest to bring the dumbbells back together over you, like hugging a large tree.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Fixed elbow bend: the movement comes from the shoulder', 'Slow on the way down'],
    mistakes: ['Bending and straightening the elbows, which turns it into a press', 'Lowering too deep with heavy weight'],
    safety: 'Use light to moderate weights. The stretched position puts the shoulder under strain.',
  },
  ex_cable_fly: {
    pattern: 'cableFly',
    setup: [
      'Set both pulleys high and grab a handle in each hand.',
      'Step forward into a split stance with a slight forward lean.',
      'Start with your arms open wide, elbows slightly bent.',
    ],
    steps: [
      'Sweep your hands down and together in front of your hips.',
      'Squeeze your chest for a moment with your hands together.',
      'Let your arms return slowly to the wide start position.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Keep the elbow bend fixed', 'Chest up, shoulders down'],
    mistakes: ['Letting the cables yank your arms back', 'Using body swing to move the weight'],
  },
  ex_pec_deck: {
    pattern: 'pecDeck',
    setup: [
      'Adjust the seat so the handles or pads are at chest height.',
      'Sit tall with your back against the pad.',
      'Place your forearms on the pads (or grip the handles), elbows at shoulder height.',
    ],
    steps: [
      'Bring the pads together in front of your chest.',
      'Pause and squeeze for a second.',
      'Return slowly until you feel a stretch, without letting the weight stack touch down.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Back stays on the pad', 'Lead with the elbows, not the hands'],
    mistakes: ['Shrugging your shoulders up', 'Letting the arms travel too far back'],
  },
  ex_chest_press_machine: {
    pattern: 'chestPressMachine',
    setup: [
      'Adjust the seat so the handles line up with your mid-chest.',
      'Sit with your back flat against the pad and feet on the floor.',
      'Grip the handles with your wrists straight.',
    ],
    steps: [
      'Press the handles forward until your arms are almost straight.',
      'Pause briefly without locking your elbows hard.',
      'Return slowly until your hands are beside your chest.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Shoulder blades back against the pad', 'Smooth, controlled tempo'],
    mistakes: ['Seat too low or high, which shifts the work to the shoulders', 'Letting the weight stack slam'],
  },
  ex_push_up: {
    pattern: 'pushUp',
    setup: [
      'Place your hands on the floor slightly wider than your shoulders.',
      'Step your feet back so your body forms a straight line from head to heels.',
      'Squeeze your glutes and brace your core.',
    ],
    steps: [
      'Bend your elbows to lower your chest toward the floor, elbows about 45° from your body.',
      'Go down until your chest is just above the floor.',
      'Push the floor away to return to straight arms.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Body moves as one plank', 'Hands under the shoulders', 'Look slightly ahead of your hands'],
    mistakes: ['Sagging hips', 'Hips piked up', 'Half reps'],
    safety: 'Too hard? Put your hands on a bench or do them from your knees.',
  },
  ex_dips_chest: {
    pattern: 'chestDip',
    setup: [
      'Grip parallel bars and jump or step up to straight arms.',
      'Bend your knees and cross your ankles behind you.',
      'Lean your torso forward about 20–30°.',
    ],
    steps: [
      'Bend your elbows to lower yourself, keeping the forward lean.',
      'Stop when your shoulders are slightly below your elbows, or when you feel a strong chest stretch.',
      'Press back up to straight arms.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows flare slightly out', 'Shoulders stay down, away from your ears'],
    mistakes: ['Dropping too deep with shoulder pain', 'Swinging the legs to get up'],
    safety: 'Skip deep dips if you have shoulder issues. An assisted dip machine is a good starting point.',
  },

  // ---------------------------------------------------------------- Back
  ex_deadlift: {
    pattern: 'deadlift',
    setup: [
      'Stand with the bar over your mid-foot, feet about hip-width apart.',
      'Hinge at the hips and bend your knees to grip the bar just outside your legs.',
      'Bring your shins to the bar, chest up, back flat.',
      'Pull the slack out of the bar so you feel tight before it leaves the floor.',
    ],
    steps: [
      'Push the floor away with your legs, keeping the bar against your legs.',
      'Once the bar passes your knees, drive your hips forward.',
      'Stand tall with hips and knees locked, shoulders over the bar.',
      'Lower by pushing your hips back first, then bending your knees once the bar passes them.',
    ],
    breathing: BRACE,
    cues: ['Bar stays in contact with your legs', 'Back stays flat, no rounding', 'Hips and shoulders rise together'],
    mistakes: ['Rounding the lower back', 'Hips shooting up first so it becomes a stiff-legged pull', 'Leaning back at the top'],
    safety: 'Learn the movement with light weight first. Stop the set if your lower back starts to round.',
  },
  ex_pull_up: {
    pattern: 'pullUp',
    setup: [
      'Grip the bar with an overhand grip, slightly wider than your shoulders.',
      'Hang with straight arms, legs still, core braced.',
    ],
    steps: [
      'Pull your shoulder blades down and back to start the movement.',
      'Drive your elbows down toward your ribs.',
      'Pull until your chin clears the bar.',
      'Lower all the way down to straight arms under control.',
    ],
    breathing: 'Breathe out as you pull up, breathe in as you lower.',
    cues: ['Chest up toward the bar', 'No kicking or swinging'],
    mistakes: ['Half reps that never reach straight arms', 'Craning the neck to get the chin over'],
    safety: 'Can’t do one yet? Use a band, an assisted machine, or slow negatives from the top.',
  },
  ex_chin_up: {
    pattern: 'pullUp',
    setup: ['Grip the bar underhand (palms facing you) about shoulder-width apart.', 'Hang with straight arms and brace your core.'],
    steps: [
      'Pull your shoulder blades down to begin.',
      'Pull your chest toward the bar, elbows travelling down and in front of you.',
      'Get your chin over the bar.',
      'Lower slowly to a full hang.',
    ],
    breathing: 'Breathe out as you pull up, breathe in as you lower.',
    cues: ['Squeeze the bar hard', 'Keep the legs quiet'],
    mistakes: ['Shrugging the shoulders up to the ears', 'Bouncing out of the bottom'],
  },
  ex_lat_pulldown: {
    pattern: 'latPulldown',
    setup: [
      'Adjust the thigh pad so your legs are locked in.',
      'Grip the bar wider than shoulder-width and sit down with straight arms.',
      'Lean back slightly, about 10–15°.',
    ],
    steps: [
      'Pull the bar down to your upper chest by driving your elbows down and back.',
      'Squeeze your shoulder blades together at the bottom.',
      'Let the bar rise slowly until your arms are straight again.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Chest up to meet the bar', 'Think "elbows to back pockets"'],
    mistakes: ['Pulling behind the neck', 'Leaning way back and using momentum'],
  },
  ex_barbell_row: {
    pattern: 'barbellRow',
    setup: [
      'Stand holding the bar with an overhand grip just outside your knees.',
      'Soften your knees and hinge forward until your torso is around 45° or lower.',
      'Let the bar hang at arm’s length, back flat.',
    ],
    steps: [
      'Pull the bar to your lower ribs, driving the elbows back.',
      'Squeeze your shoulder blades together at the top.',
      'Lower the bar under control until your arms are straight.',
    ],
    breathing: BRACE,
    cues: ['Torso angle stays fixed', 'Pull with your elbows, not your hands'],
    mistakes: ['Standing up as you row', 'Rounding the back', 'Jerking the weight up'],
    safety: 'If your lower back tires before your upper back, lighten the load or use a chest-supported row.',
  },
  ex_db_row: {
    pattern: 'dbRow',
    setup: [
      'Put one hand and the same-side knee on a bench, or brace one hand on it with a staggered stance.',
      'Hold a dumbbell in the other hand with your arm hanging straight down.',
      'Keep your back flat and roughly parallel to the floor.',
    ],
    steps: [
      'Row the dumbbell toward your hip, elbow close to your body.',
      'Squeeze your back at the top.',
      'Lower until your arm is straight and you feel a stretch.',
      'Finish all reps, then switch sides.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Pull toward the hip, not the chest', 'Keep your shoulders square to the floor'],
    mistakes: ['Twisting the torso to lift the weight', 'Shrugging instead of rowing'],
  },
  ex_seated_cable_row: {
    pattern: 'seatedRow',
    setup: [
      'Sit with your feet on the foot plate and knees slightly bent.',
      'Grab the handle and sit tall with straight arms.',
    ],
    steps: [
      'Pull the handle to your belly, driving your elbows back.',
      'Squeeze your shoulder blades together, chest proud.',
      'Extend your arms slowly, letting your shoulders reach forward slightly without rounding your back.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Torso stays nearly upright', 'Elbows close to your sides'],
    mistakes: ['Rocking back and forth to move the weight', 'Rounding the lower back on the return'],
  },
  ex_tbar_row: {
    pattern: 'barbellRow',
    setup: [
      'Straddle the bar, feet shoulder-width apart.',
      'Hinge forward with soft knees and a flat back, gripping the handle.',
    ],
    steps: ['Row the handle to your chest by driving your elbows back.', 'Pause and squeeze your back.', 'Lower under control until your arms are straight.'],
    breathing: BRACE,
    cues: ['Chest stays up', 'Fixed torso angle'],
    mistakes: ['Standing up with each rep', 'Rounding the back'],
  },
  ex_face_pull: {
    pattern: 'facePull',
    setup: [
      'Set a rope attachment at upper chest to face height.',
      'Grip the rope with thumbs pointing back toward you and step back until your arms are straight.',
      'Stand tall with a staggered stance.',
    ],
    steps: [
      'Pull the rope toward your forehead, elbows high and wide.',
      'Pull the rope ends apart and rotate your hands back so your knuckles face the ceiling.',
      'Hold briefly, then return slowly to straight arms.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows at or above shoulder height', 'Finish like a "double biceps" pose'],
    mistakes: ['Going too heavy and leaning back', 'Pulling to the chest with low elbows'],
  },
  ex_back_extension: {
    pattern: 'backExtension',
    setup: [
      'Set the pad so its top edge sits just below your hip bones.',
      'Hook your ankles under the foot pads.',
      'Cross your arms on your chest.',
    ],
    steps: [
      'Hinge at the hips to lower your torso until you feel a hamstring stretch.',
      'Squeeze your glutes to raise your torso back up.',
      'Stop when your body forms a straight line. Don’t arch past it.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Move from the hips, keep the spine neutral', 'Squeeze the glutes to lift'],
    mistakes: ['Hyperextending at the top', 'Pad too high, which blocks the hip hinge'],
  },
  ex_straight_arm_pulldown: {
    pattern: 'straightArmPulldown',
    setup: [
      'Attach a straight bar or rope to a high pulley.',
      'Step back, hinge slightly forward, and hold the bar at eye level with straight arms.',
    ],
    steps: [
      'Keeping your arms straight, sweep the bar down in an arc to your thighs.',
      'Squeeze your lats at the bottom.',
      'Let the bar rise slowly back to eye level.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows stay almost locked', 'Shoulders down, away from your ears'],
    mistakes: ['Bending the elbows so it becomes a pushdown', 'Moving the torso to swing the weight'],
  },

  // ---------------------------------------------------------------- Shoulders
  ex_ohp: {
    pattern: 'overheadPress',
    setup: [
      'Set the bar at upper-chest height and grip just outside your shoulders.',
      'Unrack with the bar on your front shoulders, elbows slightly in front of the bar.',
      'Stand with feet hip-width apart, glutes and core tight.',
    ],
    steps: [
      'Press the bar straight up, moving your head back slightly to let it pass.',
      'Once the bar passes your forehead, push your head forward under it.',
      'Lock out with the bar over your mid-foot.',
      'Lower under control back to your shoulders.',
    ],
    breathing: BRACE,
    cues: ['Squeeze your glutes so you don’t lean back', 'Bar path stays vertical'],
    mistakes: ['Leaning back into a standing incline press', 'Pressing the bar forward around your face'],
  },
  ex_db_shoulder_press: {
    pattern: 'dbShoulderPress',
    setup: [
      'Sit on an upright bench (or stand) with a dumbbell in each hand.',
      'Bring the dumbbells to shoulder height, palms forward, elbows under the wrists.',
    ],
    steps: ['Press the dumbbells overhead until your arms are straight.', 'Lower slowly back to shoulder height.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Forearms vertical', 'Ribs down, don’t over-arch the lower back'],
    mistakes: ['Lowering only halfway', 'Arching the back to finish reps'],
  },
  ex_lateral_raise: {
    pattern: 'lateralRaise',
    setup: ['Stand tall holding light dumbbells at your sides.', 'Bend your elbows slightly and lean forward a little.'],
    steps: [
      'Raise the dumbbells out to your sides, leading with the elbows.',
      'Stop at shoulder height.',
      'Lower slowly, taking about 2 seconds.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Pinkies roughly level with or slightly above thumbs', 'Reach "out" to the walls, not up'],
    mistakes: ['Swinging the body to get the weight up', 'Shrugging, which shifts the work to the traps'],
  },
  ex_cable_lateral_raise: {
    pattern: 'cableLateralRaise',
    setup: [
      'Set a pulley to its lowest position and stand side-on to it.',
      'Grab the handle with the hand farthest from the machine so the cable runs across your body.',
    ],
    steps: ['Raise your arm out to the side to shoulder height, elbow slightly bent.', 'Lower slowly against the pull of the cable.', 'Finish all reps, then switch sides.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Torso stays still', 'Lead with the elbow'],
    mistakes: ['Leaning away from the machine to cheat', 'Raising above shoulder height with a shrug'],
  },
  ex_rear_delt_fly: {
    pattern: 'rearDeltFly',
    setup: ['Hold light dumbbells and hinge forward until your torso is nearly parallel to the floor.', 'Let the dumbbells hang under your chest, elbows slightly bent.'],
    steps: [
      'Raise the dumbbells out to your sides, leading with the elbows.',
      'Squeeze the back of your shoulders at the top.',
      'Lower slowly.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Keep your neck neutral', 'Think "wide", not "squeeze the shoulder blades"'],
    mistakes: ['Standing up as the set gets hard', 'Using weights too heavy to control'],
  },
  ex_front_raise: {
    pattern: 'frontRaise',
    setup: ['Stand tall holding dumbbells in front of your thighs, palms facing you.'],
    steps: ['Raise the dumbbells in front of you with nearly straight arms.', 'Stop at shoulder height.', 'Lower slowly.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Core tight, no leaning back', 'Shoulders stay down'],
    mistakes: ['Swinging the weights with your hips', 'Raising above eye level'],
  },
  ex_arnold_press: {
    pattern: 'arnoldPress',
    setup: ['Sit on an upright bench holding dumbbells in front of your shoulders, palms facing you, elbows in front.'],
    steps: [
      'As you start pressing, open your elbows out to the sides.',
      'Rotate your palms to face forward as the dumbbells pass your head.',
      'Finish with straight arms overhead.',
      'Reverse the rotation on the way down.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Smooth rotation, no jerky twist', 'Keep the core braced'],
    mistakes: ['Rushing the rotation', 'Arching the lower back'],
  },
  ex_upright_row: {
    pattern: 'uprightRow',
    setup: ['Stand holding an EZ bar or barbell in front of your thighs with a grip at least shoulder-width.'],
    steps: ['Pull the bar up along your body, leading with your elbows.', 'Stop when your upper arms are parallel to the floor.', 'Lower slowly.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows higher than the hands', 'Bar stays close to the body'],
    mistakes: ['A narrow grip with the bar pulled to the chin', 'Using momentum'],
    safety: 'If you feel pinching in the shoulder, use a wider grip and stop lower, or swap for lateral raises.',
  },
  ex_shrug: {
    pattern: 'shrug',
    setup: ['Stand holding a barbell at arm’s length in front of your thighs, grip about shoulder-width.'],
    steps: ['Raise your shoulders straight up toward your ears.', 'Hold for a second at the top.', 'Lower all the way down.'],
    breathing: 'Breathe out as you shrug up, breathe in as you lower.',
    cues: ['Straight up and down, no rolling', 'Arms stay straight'],
    mistakes: ['Rolling the shoulders in circles', 'Bending the elbows to help'],
  },

  // ---------------------------------------------------------------- Biceps
  ex_barbell_curl: {
    pattern: 'barbellCurl',
    setup: ['Stand holding a barbell with an underhand, shoulder-width grip.', 'Arms straight, elbows at your sides.'],
    steps: ['Curl the bar toward your shoulders, keeping your elbows still.', 'Squeeze at the top.', 'Lower slowly to fully straight arms.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows pinned to your sides', 'Wrists straight'],
    mistakes: ['Swinging the hips to start the rep', 'Elbows drifting forward at the top'],
  },
  ex_db_curl: {
    pattern: 'dbCurl',
    setup: ['Stand holding dumbbells at your sides, palms facing forward.'],
    steps: ['Curl the dumbbells up, keeping your upper arms still.', 'Squeeze your biceps at the top.', 'Lower slowly to straight arms.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Only the forearms move', 'Control the way down'],
    mistakes: ['Body swing', 'Cutting the bottom of the rep short'],
  },
  ex_hammer_curl: {
    pattern: 'dbCurl',
    setup: ['Stand holding dumbbells at your sides with palms facing your body (neutral grip).'],
    steps: ['Curl the dumbbells up, keeping your palms facing in.', 'Pause near your shoulders.', 'Lower slowly.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Thumbs point up throughout', 'Elbows still'],
    mistakes: ['Rotating the wrists', 'Swinging'],
  },
  ex_preacher_curl: {
    pattern: 'preacherCurl',
    setup: ['Sit at the preacher bench with your upper arms flat on the pad and armpits snug against the top.', 'Hold an EZ bar with an underhand grip.'],
    steps: ['Curl the bar up until your forearms are nearly vertical.', 'Lower slowly until your arms are almost straight.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Upper arms stay glued to the pad', 'Slow eccentric'],
    mistakes: ['Dropping fast into the bottom', 'Lifting the elbows off the pad'],
    safety: 'Don’t lock out hard and bounce at the bottom. It stresses the elbow tendons.',
  },
  ex_cable_curl: {
    pattern: 'cableCurl',
    setup: ['Attach a straight or EZ bar to a low pulley.', 'Stand close, holding the bar with an underhand grip and straight arms.'],
    steps: ['Curl the bar toward your shoulders, elbows at your sides.', 'Squeeze at the top.', 'Lower under tension.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Keep tension on the cable at the bottom', 'Elbows still'],
    mistakes: ['Leaning back', 'Letting the weight stack touch between reps'],
  },
  ex_incline_db_curl: {
    pattern: 'inclineCurl',
    setup: ['Set a bench to about 45–60° and lie back holding dumbbells.', 'Let your arms hang straight down behind your torso, palms forward.'],
    steps: ['Curl the dumbbells up without moving your upper arms forward.', 'Squeeze at the top.', 'Lower slowly to a full stretch.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Head and back stay on the bench', 'Feel the stretch at the bottom'],
    mistakes: ['Swinging the elbows forward', 'Going too heavy for the stretched position'],
  },

  // ---------------------------------------------------------------- Triceps
  ex_tricep_pushdown: {
    pattern: 'pushdown',
    setup: ['Attach a bar or rope to a high pulley.', 'Stand close, lean forward slightly, and tuck your elbows at your sides with forearms about parallel to the floor.'],
    steps: ['Push the handle down until your arms are fully straight.', 'Squeeze your triceps.', 'Let the handle rise until your forearms are just past parallel.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows pinned, only the forearms move', 'With a rope, spread the ends apart at the bottom'],
    mistakes: ['Elbows drifting forward', 'Leaning over the weight to push with body weight'],
  },
  ex_overhead_tricep_ext: {
    pattern: 'overheadExtension',
    setup: ['Sit or stand tall holding one dumbbell overhead with both hands under the top plate.', 'Arms straight, biceps near your ears.'],
    steps: ['Bend your elbows to lower the dumbbell behind your head.', 'Go down until you feel a deep stretch in the triceps.', 'Straighten your arms to press it back up.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Elbows point forward, not out', 'Ribs down'],
    mistakes: ['Elbows flaring wide', 'Arching the lower back'],
  },
  ex_skull_crusher: {
    pattern: 'skullCrusher',
    setup: ['Lie on a flat bench holding an EZ bar over your chest with arms straight.', 'Tilt your arms back slightly toward your head.'],
    steps: ['Bend only your elbows to lower the bar toward your forehead or just behind your head.', 'Stop just short of touching.', 'Straighten your arms to press back up.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Upper arms stay still', 'Slow and controlled near your face'],
    mistakes: ['Moving the upper arms so it becomes a press', 'Rushing the lowering'],
    safety: 'Use a weight you fully control. A spotter helps when going heavy.',
  },
  ex_close_grip_bench: {
    pattern: 'closeGripBench',
    setup: ['Set up as for a bench press, with your hands about shoulder-width apart.', 'Pinch your shoulder blades back and plant your feet.'],
    steps: ['Lower the bar to your lower chest with your elbows tucked close to your body.', 'Touch lightly.', 'Press back up to straight arms.'],
    breathing: BRACE,
    cues: ['Elbows tucked about 30° from your body', 'Wrists stacked over the elbows'],
    mistakes: ['A grip so narrow it strains the wrists', 'Flaring the elbows'],
    safety: 'Use a spotter or safety arms on heavy sets.',
  },
  ex_dips_triceps: {
    pattern: 'tricepsDip',
    setup: ['Grip parallel bars and support yourself on straight arms.', 'Keep your torso upright and legs under you.'],
    steps: ['Bend your elbows to lower until they reach about 90°.', 'Keep your elbows pointing back.', 'Press back up to straight arms.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Torso upright', 'Shoulders down'],
    mistakes: ['Going too deep', 'Elbows flaring out'],
  },
  ex_bench_dip: {
    pattern: 'benchDip',
    setup: ['Sit on the edge of a bench with your hands next to your hips, fingers forward.', 'Slide your hips off the bench and walk your feet out.'],
    steps: ['Bend your elbows to lower your hips toward the floor.', 'Stop at about 90° at the elbow.', 'Press back up until your arms are straight.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Keep your back close to the bench', 'Elbows point straight back'],
    mistakes: ['Dropping too low', 'Shrugging up to the ears'],
    safety: 'Bend your knees to make it easier. Stop if you feel pain at the front of the shoulder.',
  },

  // ---------------------------------------------------------------- Legs
  ex_back_squat: {
    pattern: 'squatBack',
    setup: [
      'Set the bar at upper-chest height in a rack.',
      'Step under it and rest it on your upper back (not your neck), hands just outside your shoulders.',
      'Stand up to unrack, take two or three steps back, feet shoulder-width, toes turned out slightly.',
    ],
    steps: [
      'Brace your core, then break at the hips and knees at the same time.',
      'Sit down between your heels, knees tracking over your toes.',
      'Descend until your thighs are at least parallel to the floor.',
      'Drive up through your whole foot, keeping your chest up.',
    ],
    breathing: BRACE,
    cues: ['Knees out', 'Whole foot on the floor, weight mid-foot', 'Chest up, back flat'],
    mistakes: ['Knees caving inward', 'Heels lifting', 'Lower back rounding at the bottom'],
    safety: 'Always squat in a rack with safety bars set just below your bottom position.',
  },
  ex_front_squat: {
    pattern: 'squatFront',
    setup: [
      'Rest the bar on your front shoulders, close to your throat.',
      'Hold it with fingertips under the bar (or crossed arms), elbows high and pointing forward.',
      'Feet shoulder-width, toes slightly out.',
    ],
    steps: ['Brace and squat straight down, keeping your torso upright.', 'Go as deep as you can while keeping your elbows up.', 'Drive back up, leading with your elbows.'],
    breathing: BRACE,
    cues: ['Elbows high the whole time', 'Upright torso'],
    mistakes: ['Elbows dropping, which rolls the bar forward', 'Rounding the upper back'],
    safety: 'If you lose the bar, push it forward and step back. Set safety bars.',
  },
  ex_leg_press: {
    pattern: 'legPress',
    setup: ['Sit with your back and hips flat on the pad.', 'Place your feet shoulder-width on the platform.', 'Push the platform up and release the safety handles.'],
    steps: [
      'Lower the platform by bending your knees until they reach about 90°.',
      'Keep your lower back flat on the pad.',
      'Press back up without locking your knees hard.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Knees track over your toes', 'Push through your heels and mid-foot'],
    mistakes: ['Going so deep your hips roll off the pad', 'Snapping your knees into lockout'],
    safety: 'Re-engage the safety handles before getting out.',
  },
  ex_romanian_deadlift: {
    pattern: 'rdl',
    setup: ['Stand tall holding the bar at your thighs, hands just outside your legs.', 'Unlock your knees slightly and keep that bend.'],
    steps: [
      'Push your hips back, sliding the bar down your thighs.',
      'Keep your back flat and the bar close.',
      'Stop when you feel a strong hamstring stretch, usually around mid-shin.',
      'Drive your hips forward to stand back up.',
    ],
    breathing: BRACE,
    cues: ['Hips back, not down', 'Bar touches your legs the whole way'],
    mistakes: ['Squatting the weight down by bending the knees more', 'Rounding the back to reach lower'],
  },
  ex_leg_extension: {
    pattern: 'legExtension',
    setup: ['Adjust the back pad so your knees line up with the machine’s pivot.', 'Set the ankle pad just above your feet.', 'Hold the side handles.'],
    steps: ['Straighten your legs until your knees are fully extended.', 'Squeeze your thighs for a second.', 'Lower slowly.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Hips stay down in the seat', 'Controlled, no kicking'],
    mistakes: ['Kicking the weight up', 'Letting the stack drop'],
  },
  ex_leg_curl: {
    pattern: 'lyingLegCurl',
    setup: ['Lie face down with your knees just off the bench edge.', 'Set the pad just above your heels and hold the handles.'],
    steps: ['Curl the pad toward your glutes.', 'Squeeze your hamstrings at the top.', 'Lower slowly to straight legs.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Hips stay pressed into the bench', 'Slow on the way down'],
    mistakes: ['Lifting the hips to help', 'Partial reps'],
  },
  ex_seated_leg_curl: {
    pattern: 'seatedLegCurl',
    setup: ['Sit with the backs of your knees at the seat edge, lined up with the pivot.', 'Lower the thigh pad to lock your legs in, and set the lower pad just above your heels.'],
    steps: ['Curl your heels down and back as far as you can.', 'Pause and squeeze.', 'Return slowly to straight legs.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Sit tall', 'Full range of motion'],
    mistakes: ['Letting the weight snap back', 'Thigh pad too loose'],
  },
  ex_bulgarian_split_squat: {
    pattern: 'bulgarian',
    setup: [
      'Stand about two steps in front of a bench, facing away from it.',
      'Place the top of your rear foot on the bench.',
      'Hold dumbbells at your sides, front foot flat.',
    ],
    steps: [
      'Lower straight down by bending your front knee until your back knee nearly touches the floor.',
      'Keep your front knee tracking over your toes.',
      'Push through your front heel to stand back up.',
      'Finish all reps, then switch legs.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Most of your weight on the front leg', 'A slight forward lean is fine'],
    mistakes: ['Front foot too close to the bench', 'Front knee caving inward'],
    safety: 'Practise with body weight first. Balance is the hard part.',
  },
  ex_walking_lunge: {
    pattern: 'walkingLunge',
    setup: ['Stand tall holding dumbbells at your sides, with clear space in front of you.'],
    steps: [
      'Take a long step forward.',
      'Lower until your back knee nearly touches the floor and both knees are about 90°.',
      'Push through your front foot and bring your back foot forward into the next step.',
    ],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Torso upright', 'Front knee over the ankle'],
    mistakes: ['Steps too short, which overloads the knee', 'Wobbling: slow down and widen your stance'],
  },
  ex_goblet_squat: {
    pattern: 'squatGoblet',
    setup: ['Hold a dumbbell vertically against your chest with both hands under the top end.', 'Feet shoulder-width apart, toes slightly out.'],
    steps: ['Squat down between your knees, keeping your chest up.', 'Go as deep as you can with a flat back, elbows inside your knees.', 'Drive back up through your whole foot.'],
    breathing: BRACE,
    cues: ['Weight stays against your chest', 'Push your knees out with your elbows at the bottom'],
    mistakes: ['Heels lifting', 'Leaning forward and dropping the weight away from your body'],
  },
  ex_hack_squat: {
    pattern: 'hackSquat',
    setup: ['Stand on the platform with your back flat against the pad and shoulders under the shoulder pads.', 'Feet shoulder-width, slightly forward on the platform.', 'Release the safety handles.'],
    steps: ['Lower until your thighs are parallel to the platform.', 'Keep your back flat on the pad.', 'Press back up without locking your knees hard.'],
    breathing: BRACE,
    cues: ['Knees track over your toes', 'Control the bottom'],
    mistakes: ['Heels lifting', 'Bouncing out of the bottom'],
    safety: 'Re-engage the safety handles before stepping out.',
  },
  ex_standing_calf_raise: {
    pattern: 'calfRaise',
    setup: ['Stand with the balls of your feet on the edge of the platform and your shoulders under the pads.', 'Let your heels hang just below the platform.'],
    steps: ['Rise onto your toes as high as you can.', 'Pause for a second at the top.', 'Lower slowly into a full stretch.'],
    breathing: 'Breathe out as you rise, breathe in as you lower.',
    cues: ['Knees straight but not locked', 'Pause at the top and bottom, no bouncing'],
    mistakes: ['Bouncing quickly through short reps', 'Bending the knees to help'],
  },
  ex_seated_calf_raise: {
    pattern: 'seatedCalfRaise',
    setup: ['Sit with the balls of your feet on the platform and the pad snug on your lower thighs.', 'Release the safety lever.'],
    steps: ['Push up onto your toes, raising your heels as high as possible.', 'Pause at the top.', 'Lower slowly into a stretch.'],
    breathing: 'Breathe out as you rise, breathe in as you lower.',
    cues: ['Full range, slow tempo'],
    mistakes: ['Bouncing', 'Using a range so short it barely moves'],
  },

  // ---------------------------------------------------------------- Glutes
  ex_hip_thrust: {
    pattern: 'hipThrust',
    setup: [
      'Sit on the floor with your upper back against the edge of a bench.',
      'Roll the bar over your hips (use a pad).',
      'Plant your feet hip-width apart so your shins will be vertical at the top.',
    ],
    steps: [
      'Drive through your heels to lift your hips.',
      'Rise until your torso is parallel to the floor and your knees are at 90°.',
      'Squeeze your glutes hard for a second.',
      'Lower your hips under control.',
    ],
    breathing: BRACE,
    cues: ['Chin tucked, eyes forward', 'Ribs down, no lower-back arch at the top'],
    mistakes: ['Hyperextending the lower back instead of using the glutes', 'Feet too far forward or back'],
  },
  ex_glute_bridge: {
    pattern: 'gluteBridge',
    setup: ['Lie on your back with your knees bent and feet flat, hip-width apart.', 'Arms on the floor by your sides.'],
    steps: ['Push through your heels to lift your hips.', 'Stop when your body forms a straight line from shoulders to knees.', 'Squeeze your glutes, then lower slowly.'],
    breathing: 'Breathe out as you lift, breathe in as you lower.',
    cues: ['Squeeze your glutes to lift, not your lower back', 'Knees stay hip-width apart'],
    mistakes: ['Arching the lower back at the top', 'Pushing through the toes'],
  },
  ex_cable_kickback: {
    pattern: 'cableKickback',
    setup: ['Attach an ankle strap to a low pulley and fasten it on one ankle.', 'Face the machine, hold it for support, and hinge forward slightly.'],
    steps: ['Kick the strapped leg back and up, keeping the knee slightly bent.', 'Squeeze your glute at the top.', 'Return slowly.', 'Finish all reps, then switch legs.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Torso still', 'Movement comes from the hip'],
    mistakes: ['Arching the lower back to lift higher', 'Swinging the leg'],
  },
  ex_hip_abduction: {
    pattern: 'hipAbduction',
    setup: ['Sit in the machine with the pads against the outside of your knees.', 'Sit tall and hold the handles.'],
    steps: ['Push your knees outward as far as you comfortably can.', 'Pause and squeeze.', 'Return slowly without letting the weights touch.'],
    breathing: EXHALE_ON_EFFORT,
    cues: ['Controlled, steady tempo', 'Try a slight forward lean to hit the glutes more'],
    mistakes: ['Letting the pads snap back together', 'Using momentum'],
  },
  ex_sumo_deadlift: {
    pattern: 'sumoDeadlift',
    setup: [
      'Take a wide stance with toes pointed out, shins close to the bar.',
      'Grip the bar inside your knees, arms hanging straight down.',
      'Push your knees out, chest up, back flat.',
    ],
    steps: [
      'Push the floor apart with your feet to lift the bar.',
      'Keep the bar close and your torso upright.',
      'Lock out by squeezing your glutes.',
      'Lower with control, hips back and knees out.',
    ],
    breathing: BRACE,
    cues: ['Knees track over your toes', 'Hips close to the bar'],
    mistakes: ['Knees caving in', 'Hips rising before the bar moves'],
    safety: 'Build up gradually. The wide stance puts more demand on the hips and groin.',
  },

  // ---------------------------------------------------------------- Abs
  ex_plank: {
    pattern: 'plank',
    setup: ['Place your forearms on the floor, elbows under your shoulders.', 'Step your feet back so your body is straight from head to heels.'],
    steps: ['Squeeze your glutes and brace your abs as if bracing for a punch.', 'Hold the position without letting your hips sag or rise.', 'Log the hold time in seconds as reps.'],
    breathing: STEADY,
    cues: ['Pull your elbows toward your toes to tighten everything', 'Neck in line with your spine'],
    mistakes: ['Hips sagging', 'Hips piked high', 'Holding your breath'],
  },
  ex_crunch: {
    pattern: 'crunch',
    setup: ['Lie on your back with your knees bent and feet flat.', 'Cross your arms on your chest or rest your fingertips lightly behind your ears.'],
    steps: ['Curl your shoulders off the floor by bringing your ribs toward your hips.', 'Pause and squeeze your abs.', 'Lower slowly.'],
    breathing: 'Breathe out as you curl up, breathe in as you lower.',
    cues: ['Small movement: think "curl", not "sit up"', 'Lower back stays on the floor'],
    mistakes: ['Pulling on your neck', 'Using momentum'],
  },
  ex_hanging_leg_raise: {
    pattern: 'hangingLegRaise',
    setup: ['Hang from a bar with straight arms and shoulders active.', 'Legs together and still.'],
    steps: ['Raise your legs in front of you to hip height or higher.', 'Curl your pelvis up at the top.', 'Lower slowly without swinging.'],
    breathing: 'Breathe out as you raise your legs, breathe in as you lower.',
    cues: ['No swinging. Pause at the bottom if needed', 'Bend your knees to make it easier'],
    mistakes: ['Using momentum to swing the legs up', 'Only lifting with the hip flexors without curling the pelvis'],
  },
  ex_cable_crunch: {
    pattern: 'cableCrunch',
    setup: ['Attach a rope to a high pulley and kneel facing the machine.', 'Hold the rope beside your head.'],
    steps: ['Crunch down by curling your ribs toward your hips.', 'Keep your hips still over your knees.', 'Return slowly to upright.'],
    breathing: 'Breathe out as you crunch down, breathe in as you return.',
    cues: ['Round your spine, don’t hinge at the hips', 'Hands stay by your head'],
    mistakes: ['Sitting back on your heels so the hips do the work', 'Pulling with the arms'],
  },
  ex_russian_twist: {
    pattern: 'russianTwist',
    setup: ['Sit with your knees bent and lean back slightly with a straight back.', 'Lift your feet off the floor (or keep heels down to make it easier).', 'Hold your hands or a weight in front of your chest.'],
    steps: ['Rotate your torso to one side, bringing your hands beside your hip.', 'Rotate to the other side.', 'Each side counts as one rep.'],
    breathing: 'Breathe out as you rotate to each side.',
    cues: ['Rotate from the ribs, not just the arms', 'Chest proud'],
    mistakes: ['Rounding the back', 'Moving only the arms'],
  },
  ex_ab_wheel: {
    pattern: 'abWheel',
    setup: ['Kneel on a mat holding the ab wheel under your shoulders.', 'Brace your abs and tuck your pelvis slightly.'],
    steps: ['Roll the wheel forward slowly, extending your body.', 'Go only as far as you can without your lower back sagging.', 'Pull the wheel back to the start using your abs.'],
    breathing: 'Breathe in as you roll out, breathe out as you pull back.',
    cues: ['Keep your hips tucked under', 'Short range first, extend gradually'],
    mistakes: ['Lower back sagging at full extension', 'Hips leading on the way back'],
    safety: 'Start with short rollouts or roll toward a wall to limit range.',
  },

  // ---------------------------------------------------------------- Cardio
  ex_treadmill: {
    pattern: 'treadmill',
    setup: ['Stand on the side rails, start the belt at a slow walk, then step on.', 'Clip on the safety key if there is one.'],
    steps: ['Walk for 3–5 minutes to warm up.', 'Increase speed or incline to your working pace.', 'Land with your foot under your body, not far in front.', 'Cool down with a few minutes of walking. Log the minutes as reps.'],
    breathing: STEADY,
    cues: ['Upright posture, relaxed shoulders', 'Short, quick steps'],
    mistakes: ['Holding the handrails while walking on a steep incline', 'Overstriding'],
  },
  ex_rowing_machine: {
    pattern: 'rower',
    setup: ['Strap your feet in with the strap across the widest part of your foot.', 'Sit tall, hold the handle with straight arms, and slide forward until your shins are vertical.'],
    steps: [
      'Drive: push with your legs first.',
      'Then swing your torso back slightly.',
      'Finally pull the handle to your lower ribs.',
      'Recovery: arms extend, torso leans forward, then knees bend. Log the minutes as reps.',
    ],
    breathing: 'Breathe out during the drive, breathe in during the recovery.',
    cues: ['Legs, body, arms, then arms, body, legs', 'About 60% legs, 20% body, 20% arms'],
    mistakes: ['Pulling with the arms first', 'Bending the knees before the handle passes them on the recovery'],
  },
  ex_stationary_bike: {
    pattern: 'bike',
    setup: ['Set the seat so your knee is slightly bent at the bottom of the pedal stroke.', 'Set the handlebars so you can reach them with a straight back.'],
    steps: ['Start pedalling at low resistance for a few minutes.', 'Raise the resistance to your working level.', 'Keep a smooth, circular pedal stroke. Log the minutes as reps.'],
    breathing: STEADY,
    cues: ['Hips stay still on the saddle', 'Relaxed grip and shoulders'],
    mistakes: ['Seat too low, which strains the knees', 'Bouncing in the saddle at high cadence with no resistance'],
  },
  ex_jump_rope: {
    pattern: 'jumpRope',
    setup: ['Stand on the middle of the rope. The handles should reach about your armpits.', 'Hold the handles at hip height with elbows close to your body.'],
    steps: ['Turn the rope with your wrists, not your arms.', 'Jump just high enough to clear the rope, landing softly on the balls of your feet.', 'Keep a steady rhythm. Log the minutes or rounds as reps.'],
    breathing: STEADY,
    cues: ['Small hops, about 2–3 cm', 'Elbows in, wrists turning'],
    mistakes: ['Jumping too high', 'Swinging the whole arm', 'Landing on your heels'],
  },
  ex_stair_climber: {
    pattern: 'stairClimber',
    setup: ['Step on and hold the rails lightly for balance only.', 'Start at a slow speed.'],
    steps: ['Climb with your whole foot on each step.', 'Stand tall with a slight forward lean from the ankles.', 'Increase the speed to your working pace. Log the minutes as reps.'],
    breathing: STEADY,
    cues: ['Push through your heels', 'Hands light on the rails'],
    mistakes: ['Leaning on the rails and hunching over', 'Only stepping on your toes'],
  },

  // ---------------------------------------------------------------- Full body
  ex_burpee: {
    pattern: 'burpee',
    setup: ['Stand with your feet shoulder-width apart.'],
    steps: [
      'Squat down and place your hands on the floor.',
      'Jump or step your feet back into a plank.',
      'Optionally do a push-up.',
      'Jump or step your feet back to your hands.',
      'Jump up explosively with your arms overhead.',
    ],
    breathing: 'Breathe out as you jump up. Find a rhythm and keep breathing throughout.',
    cues: ['Land softly', 'Keep the plank straight, no sagging hips'],
    mistakes: ['Sagging hips in the plank', 'Landing stiff-legged'],
    safety: 'Step back instead of jumping to make it lower-impact.',
  },
  ex_kb_swing: {
    pattern: 'kbSwing',
    setup: ['Stand with feet slightly wider than your hips, the kettlebell on the floor a foot in front of you.', 'Hinge and grip the handle with both hands, back flat.'],
    steps: [
      'Hike the bell back between your legs.',
      'Snap your hips forward hard to stand up, letting the bell float to chest height.',
      'Let it swing back down and hinge to absorb it, bell passing high between your thighs.',
    ],
    breathing: 'Breathe in on the backswing, breathe out sharply as your hips snap forward.',
    cues: ['It’s a hip hinge, not a squat', 'Arms are just ropes. The hips drive the bell'],
    mistakes: ['Lifting the bell with your arms or shoulders', 'Squatting down instead of hinging', 'Rounding the back'],
  },
  ex_clean_press: {
    pattern: 'cleanPress',
    setup: ['Set up as for a deadlift: bar over mid-foot, hands just outside your legs, back flat.'],
    steps: [
      'Pull the bar off the floor, keeping it close.',
      'As it passes mid-thigh, extend your hips explosively and shrug.',
      'Pull yourself under the bar and catch it on your front shoulders, elbows forward.',
      'Stand tall, then press the bar overhead.',
      'Lower it to your shoulders, then to the floor under control.',
    ],
    breathing: 'Brace for the clean, take a breath at the shoulders, brace again for the press.',
    cues: ['Bar stays close to your body', 'Fast elbows in the catch'],
    mistakes: ['Pulling with the arms early', 'Catching with low elbows', 'Leaning back on the press'],
    safety: 'This is a technical lift. Learn it with an empty bar or a coach before adding load.',
  },
  ex_thruster: {
    pattern: 'thruster',
    setup: ['Hold dumbbells (or a bar) at your shoulders, elbows forward.', 'Feet shoulder-width apart.'],
    steps: ['Squat down to at least parallel, chest up.', 'Drive up out of the squat explosively.', 'Use that drive to press the weights overhead in one motion.', 'Lower the weights to your shoulders as you descend into the next squat.'],
    breathing: 'Breathe in at the top or on the way down, breathe out as you drive up and press.',
    cues: ['One continuous movement', 'Legs drive the press'],
    mistakes: ['Pausing at the top of the squat and pressing with the arms only', 'Elbows dropping in the squat'],
  },
  ex_farmers_walk: {
    pattern: 'farmersWalk',
    setup: ['Deadlift a heavy dumbbell or kettlebell in each hand, back flat.', 'Stand tall, shoulders back and down.'],
    steps: ['Walk forward with short, controlled steps.', 'Keep the weights still at your sides.', 'Walk for the set distance or time, then set the weights down with a flat back. Log distance or seconds as reps.'],
    breathing: STEADY,
    cues: ['Tall posture, eyes forward', 'Crush the handles'],
    mistakes: ['Leaning to one side', 'Shrugging the shoulders up'],
  },
};

/** Guides keyed by built-in exercise ID (see constants/exerciseLibrary.ts). */
export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = Object.fromEntries(
  Object.entries(GUIDE_CONTENT).map(([id, g]) => [id, { ...g, muscles: parseMuscles(id) }]),
);

export function getExerciseGuide(exerciseId: string): ExerciseGuide | null {
  return EXERCISE_GUIDES[exerciseId] ?? null;
}
