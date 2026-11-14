import { FLOOR, LEN, type Limb, type Pose, type Vec, type View } from './skeleton';

/** Equipment drawn relative to the figure each frame. */
export type PropDef =
  /** Side view: a plate seen end-on. Front view: a bar across both hands with plates. */
  | { kind: 'barbell'; at?: 'hands' | 'shoulder' | 'hip'; offset?: Vec }
  | { kind: 'dumbbell' }
  | { kind: 'kettlebell' }
  /** Cable from a hand (or the near ankle) to a fixed pulley. `both` adds the far hand. */
  | { kind: 'cable'; anchor: Vec; from?: 'hand' | 'ankle'; both?: boolean }
  /** Round machine pad at a joint. */
  | { kind: 'pad'; at: 'ankleN' | 'kneeN' | 'shoulder' | 'hip' }
  /** Foot plate that moves with the feet (leg press). Angle in degrees from vertical. */
  | { kind: 'platform'; angle: number }
  | { kind: 'wheel' }
  | { kind: 'rope' };

/** Static scenery: a stroked line (x1, y1, x2, y2) or a circle (cx, cy, r). */
export type SceneDef = { line: [number, number, number, number]; w?: number } | { circle: [number, number, number] };

export interface MovementPattern {
  view: View;
  /** Keyframes. With `pingpong` the loop plays forward then back. */
  frames: Pose[];
  pingpong?: boolean;
  /** Milliseconds per keyframe transition. */
  tempo: number;
  /** Fraction of each transition spent holding the keyframe, 0–0.3. */
  hold?: number;
  /** Side view: which way toes point, 1 = facing direction, -1 = behind. */
  feet?: number;
  /** Side view: -1 when the figure lies face up (chest toward the ceiling). Default 1. */
  facing?: number;
  scene?: SceneDef[];
  props?: PropDef[];
}

function normalizeLimb(l: Limb): Limb {
  return 'ik' in l ? { ik: l.ik, bend: l.bend, rel: l.rel ?? 0, len: l.len ?? [1, 1] } : { fk: l.fk, rel: l.rel ?? 0, len: l.len ?? [1, 1] };
}

/**
 * Fill every optional field with its default so all keyframes share one shape and every
 * value interpolates (a field missing from one keyframe would otherwise snap).
 */
function normalizePose(p: Pose): Pose {
  return {
    hip: p.hip,
    torso: p.torso,
    torsoLen: p.torsoLen ?? 1,
    neck: p.neck ?? 1,
    head: p.head ?? 0,
    rope: p.rope ?? 0,
    armN: normalizeLimb(p.armN),
    legN: normalizeLimb(p.legN),
    ...(p.armF ? { armF: normalizeLimb(p.armF) } : null),
    ...(p.legF ? { legF: normalizeLimb(p.legF) } : null),
    ...(p.toeN ? { toeN: p.toeN } : null),
    ...(p.toeF ? { toeF: p.toeF } : null),
  };
}

const loopCache = new WeakMap<MovementPattern, Pose[]>();

/** Loop frames (normalized), expanding ping-pong sequences. */
export function loopFrames(p: MovementPattern): Pose[] {
  const cached = loopCache.get(p);
  if (cached) return cached;
  const frames = p.frames.map(normalizePose);
  const out = !p.pingpong || frames.length < 2 ? frames : [...frames, ...frames.slice(1, -1).reverse()];
  loopCache.set(p, out);
  return out;
}

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

const F = FLOOR;
const rad = (d: number) => (d * Math.PI) / 180;

/** Pelvis position that puts the shoulders at `sh` for a given torso angle. */
function hipUnder(sh: Vec, torso: number, torsoLen = 1): Vec {
  const l = LEN.torso * torsoLen;
  return [sh[0] - Math.sin(rad(torso)) * l, sh[1] + Math.cos(rad(torso)) * l];
}

const foot = (x: number, y = F, bend = 1): Limb => ({ ik: [x, y], bend });
const hand = (x: number, y: number, bend = -1): Limb => ({ ik: [x, y], bend });
const fk = (a: number, b: number, len?: Vec): Limb => (len ? { fk: [a, b], len } : { fk: [a, b] });
const fkRel = (a: number, b: number): Limb => ({ fk: [a, b], rel: 1 });
const relHand = (x: number, y: number, bend = -1): Limb => ({ ik: [x, y], bend, rel: 1 });
const HANG = fk(3, 4);

const floorSeat = (x1: number, x2: number, y: number): SceneDef[] => [
  { line: [x1, y, x2, y], w: 7 },
  { line: [(x1 + x2) / 2, y + 4, (x1 + x2) / 2, F], w: 3 },
];
const FLAT_BENCH: SceneDef[] = [
  { line: [40, 113, 132, 113], w: 7 },
  { line: [50, 117, 50, F], w: 3 },
  { line: [122, 117, 122, F], w: 3 },
];
const PULL_BAR: SceneDef[] = [{ circle: [110, 14, 3] }, { line: [110, 14, 150, -16], w: 2 }];

// Standing reference: feet under the hips, shoulders at y ≈ 41.
const STAND_X = 96;
const STAND_HIP: Vec = [STAND_X, 86];

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const squatBack: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'barbell', at: 'shoulder', offset: [-3, -2] }],
  frames: [
    { hip: [97, 86], torso: 8, armN: relHand(-6, 2, 1), legN: foot(101) },
    { hip: [78, 118], torso: 36, armN: relHand(-6, 2, 1), legN: foot(101) },
  ],
};

const frontRack = fk(80, 150);
const squatFront: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'barbell', at: 'shoulder', offset: [7, -3] }],
  frames: [
    { hip: [97, 86], torso: 4, armN: frontRack, legN: foot(101) },
    { hip: [82, 120], torso: 18, armN: frontRack, legN: foot(101) },
  ],
};

const gobletHold = fk(20, 140);
const squatGoblet: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [97, 86], torso: 4, armN: gobletHold, legN: foot(101) },
    { hip: [82, 120], torso: 20, armN: gobletHold, legN: foot(101) },
  ],
};

const hackSquat: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'pad', at: 'shoulder' }],
  scene: [{ line: [70, F, 140, F - 14], w: 5 }],
  frames: [
    { hip: [92, 82], torso: -12, armN: fkRel(30, 120), legN: foot(106, F - 10) },
    { hip: [76, 112], torso: -12, armN: fkRel(30, 120), legN: foot(106, F - 10) },
  ],
};

const deadlift: MovementPattern = {
  view: 'side',
  tempo: 1400,
  pingpong: true,
  hold: 0.15,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [76, 106], torso: 60, armN: hand(103, 137), legN: foot(100) },
    { hip: STAND_HIP, torso: 0, armN: hand(99, 94), legN: foot(100) },
  ],
};

const rdl: MovementPattern = {
  view: 'side',
  tempo: 1500,
  pingpong: true,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: STAND_HIP, torso: 0, armN: hand(99, 94), legN: foot(99) },
    { hip: [80, 90], torso: 72, armN: hand(108, 124), legN: foot(99) },
  ],
};

const sumoDeadlift: MovementPattern = {
  view: 'front',
  tempo: 1400,
  pingpong: true,
  hold: 0.15,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [100, 108], torso: 0, torsoLen: 0.72, armN: hand(108, 136, -1), legN: foot(130, F, 1) },
    { hip: [100, 88], torso: 0, armN: hand(109, 96, -1), legN: foot(130, F, 1) },
  ],
};

// Supine on a flat bench: hips at x 70, shoulders at x 114, feet on the floor.
const benchLegs = foot(46, F, -1);
const benchPress: MovementPattern = {
  facing: -1,
  view: 'side',
  tempo: 1300,
  pingpong: true,
  feet: -1,
  scene: FLAT_BENCH,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [70, 106], torso: 90, armN: hand(109, 58, 1), legN: benchLegs },
    { hip: [70, 106], torso: 90, armN: hand(105, 94, 1), legN: benchLegs },
  ],
};
const benchPressDb: MovementPattern = { ...benchPress, props: [{ kind: 'dumbbell' }] };
const closeGripBench: MovementPattern = { ...benchPress };

const INCLINE_BENCH: SceneDef[] = [
  { line: [74, 117, 107, 94], w: 7 },
  { line: [50, 119, 80, 119], w: 7 },
  { line: [80, 121, 80, F], w: 3 },
];
const incline = (bar: PropDef): MovementPattern => ({
  facing: -1,
  view: 'side',
  tempo: 1300,
  pingpong: true,
  feet: -1,
  scene: INCLINE_BENCH,
  props: [bar],
  frames: [
    { hip: [70, 112], torso: 55, armN: hand(101, 38, 1), legN: foot(44, F, -1) },
    { hip: [70, 112], torso: 55, armN: hand(97, 78, 1), legN: foot(44, F, -1) },
  ],
});

// Fly family: front view. Wide arms sweep together in front of the chest.
const BENCH_TOP: SceneDef[] = [{ line: [100, 30, 100, 116], w: 22 }];
const flyFrames = (hipY: number, legs: Limb, wide: Vec, closed: Vec): Pose[] => [
  { hip: [100, hipY], torso: 0, armN: { ik: wide, bend: -1 }, legN: legs },
  { hip: [100, hipY], torso: 0, armN: { ik: closed, bend: -1, len: [0.5, 0.5] }, legN: legs },
];
const dbFly: MovementPattern = {
  view: 'front',
  tempo: 1400,
  pingpong: true,
  scene: BENCH_TOP,
  props: [{ kind: 'dumbbell' }],
  frames: flyFrames(96, foot(116, F - 6, 1), [152, 50], [104, 50]),
};
const cableFly: MovementPattern = {
  view: 'front',
  tempo: 1400,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [186, -8], both: true }],
  frames: [
    { hip: [100, 86], torso: 0, armN: hand(148, 30, -1), legN: foot(112) },
    { hip: [100, 86], torso: 0, armN: { ik: [104, 92], bend: -1, len: [0.8, 0.8] }, legN: foot(112) },
  ],
};
const SEATED_FRONT_LEGS = fk(14, -14, [0.45, 1]);
const pecDeck: MovementPattern = {
  view: 'front',
  tempo: 1400,
  pingpong: true,
  scene: [{ line: [82, 112, 118, 112], w: 6 }, { line: [100, 116, 100, F], w: 3 }],
  props: [{ kind: 'pad', at: 'hip' }],
  frames: [
    { hip: [100, 106], torso: 0, armN: fk(90, 90), legN: SEATED_FRONT_LEGS },
    { hip: [100, 106], torso: 0, armN: fk(90, 90, [0.35, 1]), legN: SEATED_FRONT_LEGS },
  ],
};

const SEAT_UPRIGHT: SceneDef[] = [...floorSeat(62, 98, 113), { line: [60, 112, 60, 56], w: 6 }];
const SEATED_SIDE_LEGS = fk(90, -90);
const chestPressMachine: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  scene: SEAT_UPRIGHT,
  frames: [
    { hip: [72, 108], torso: -4, armN: hand(92, 66), legN: SEATED_SIDE_LEGS },
    { hip: [72, 108], torso: -4, armN: hand(118, 66), legN: SEATED_SIDE_LEGS },
  ],
};

// Push-up: feet fixed, hands fixed under the shoulders.
const pushUp: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  frames: [
    { hip: [92, 118], torso: 62, armN: hand(132, F - 1), legN: foot(36, F - 2) },
    { hip: [100, 136], torso: 80, armN: hand(132, F - 1), legN: foot(36, F - 2) },
  ],
};

const DIP_BARS: SceneDef[] = [{ line: [70, 82, 132, 82], w: 4 }, { line: [126, 84, 126, F], w: 3 }];
const dipLegs = fk(-8, -80);
const dip = (lean: number): MovementPattern => ({
  view: 'side',
  tempo: 1200,
  pingpong: true,
  scene: DIP_BARS,
  frames: [
    { hip: hipUnder([102, 33], lean), torso: lean, armN: hand(102, 80), legN: dipLegs },
    { hip: hipUnder([105, 62], lean), torso: lean, armN: hand(102, 80), legN: dipLegs },
  ],
});

const benchDip: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  scene: [{ line: [30, 104, 74, 104], w: 7 }, { line: [40, 108, 40, F], w: 3 }, { line: [66, 108, 66, F], w: 3 }],
  frames: [
    { hip: [82, 96], torso: -4, armN: hand(70, 100, 1), legN: foot(146, F, -1) },
    { hip: [80, 122], torso: -10, armN: hand(70, 100, 1), legN: foot(146, F, -1) },
  ],
};

// Hanging: hands on a bar at (110, 14).
const hangLegs = fk(6, -28);
const pullUp: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  hold: 0.15,
  scene: PULL_BAR,
  frames: [
    { hip: hipUnder([106, 63], -4), torso: -4, armN: hand(110, 16), legN: hangLegs },
    { hip: hipUnder([104, 30], -16), torso: -16, armN: hand(110, 16), legN: hangLegs },
  ],
};

const hangingLegRaise: MovementPattern = {
  view: 'side',
  tempo: 1400,
  pingpong: true,
  scene: PULL_BAR,
  frames: [
    { hip: hipUnder([108, 63], -2), torso: -2, armN: hand(110, 16), legN: fk(2, -4) },
    { hip: hipUnder([106, 63], -10), torso: -10, armN: hand(110, 16), legN: fk(92, -6) },
  ],
};

const SEAT_LOW: SceneDef[] = [...floorSeat(72, 112, 117)];
const latPulldown: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  scene: [...SEAT_LOW, { circle: [124, 100, 5] }],
  props: [{ kind: 'cable', anchor: [92, -16] }],
  frames: [
    { hip: [92, 112], torso: -8, armN: hand(94, 16), legN: SEATED_SIDE_LEGS },
    { hip: [92, 112], torso: -14, armN: hand(96, 62), legN: SEATED_SIDE_LEGS },
  ],
};

const straightArmPulldown: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [178, -6] }],
  frames: [
    { hip: [92, 88], torso: 24, armN: fk(150, 6), legN: foot(98) },
    { hip: [92, 88], torso: 24, armN: fk(18, 4), legN: foot(98) },
  ],
};

const facePull: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [186, 30] }],
  frames: [
    { hip: [90, 86], torso: -4, armN: fk(92, 0), legN: foot(94), legF: foot(78) },
    { hip: [90, 86], torso: -6, armN: fk(92, 92, [0.35, 1]), legN: foot(94), legF: foot(78) },
  ],
};

const bentRowFrames = (topHand: Vec): Pose[] => [
  { hip: [84, 92], torso: 70, armN: hand(122, 126), legN: foot(100) },
  { hip: [84, 92], torso: 70, armN: hand(topHand[0], topHand[1]), legN: foot(100) },
];
const barbellRow: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  props: [{ kind: 'barbell' }],
  frames: bentRowFrames([108, 96]),
};

const ROW_BENCH: SceneDef[] = [{ line: [120, 110, 176, 110], w: 7 }, { line: [130, 114, 130, F], w: 3 }, { line: [168, 114, 168, F], w: 3 }];
const dbRow: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  scene: ROW_BENCH,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [82, 90], torso: 76, armN: hand(120, 128), armF: hand(140, 106, -1), legN: foot(92), legF: foot(70) },
    { hip: [82, 90], torso: 76, armN: hand(100, 94), armF: hand(140, 106, -1), legN: foot(92), legF: foot(70) },
  ],
};

const seatedRow: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  scene: [...floorSeat(56, 98, 128), { line: [148, 110, 148, F], w: 5 }],
  props: [{ kind: 'cable', anchor: [150, 118] }],
  frames: [
    { hip: [78, 122], torso: 16, armN: hand(134, 92), legN: foot(142, 132, 1) },
    { hip: [78, 122], torso: -6, armN: hand(86, 100), legN: foot(142, 132, 1) },
  ],
};

const backExtension: MovementPattern = {
  view: 'side',
  tempo: 1400,
  pingpong: true,
  scene: [{ line: [92, 112, 110, 96], w: 7 }, { line: [44, 148, 60, 136], w: 5 }, { line: [56, 140, 100, 104], w: 3 }],
  frames: [
    { hip: [100, 98], torso: 46, armN: fkRel(30, 150), legN: foot(52, 140) },
    { hip: [100, 98], torso: 128, armN: fkRel(30, 150), legN: foot(52, 140) },
  ],
};

const overheadPress: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: STAND_HIP, torso: -3, armN: hand(105, 40), legN: foot(98) },
    { hip: STAND_HIP, torso: 0, armN: hand(98, -6), legN: foot(98) },
  ],
};

const SEATED_FRONT_SCENE: SceneDef[] = [{ line: [80, 112, 120, 112], w: 6 }, { line: [100, 116, 100, F], w: 3 }];
const dbShoulderPress: MovementPattern = {
  view: 'front',
  tempo: 1200,
  pingpong: true,
  scene: SEATED_FRONT_SCENE,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [100, 106], torso: 0, armN: hand(136, 54, -1), legN: SEATED_FRONT_LEGS },
    { hip: [100, 106], torso: 0, armN: hand(118, 4, -1), legN: SEATED_FRONT_LEGS },
  ],
};

const arnoldPress: MovementPattern = {
  ...dbShoulderPress,
  frames: [
    { hip: [100, 106], torso: 0, armN: { ik: [108, 48], bend: -1, len: [0.45, 1] }, legN: SEATED_FRONT_LEGS },
    { hip: [100, 106], torso: 0, armN: { ik: [136, 54], bend: -1, len: [1, 1] }, legN: SEATED_FRONT_LEGS },
    { hip: [100, 106], torso: 0, armN: { ik: [118, 4], bend: -1, len: [1, 1] }, legN: SEATED_FRONT_LEGS },
  ],
};

const lateralRaise: MovementPattern = {
  view: 'front',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [100, 86], torso: 0, armN: fk(10, 4), legN: foot(110) },
    { hip: [100, 86], torso: 0, armN: fk(88, 6), legN: foot(110) },
  ],
};

const cableLateralRaise: MovementPattern = {
  view: 'front',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [80, 146] }],
  frames: [
    { hip: [100, 86], torso: 0, armN: fk(-8, 4), armF: fk(4, 4), legN: foot(110) },
    { hip: [100, 86], torso: 0, armN: fk(86, 6), armF: fk(4, 4), legN: foot(110) },
  ],
};

const rearDeltFly: MovementPattern = {
  view: 'front',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [100, 92], torso: 0, torsoLen: 0.4, neck: -1.2, armN: fk(4, 6), legN: foot(112) },
    { hip: [100, 92], torso: 0, torsoLen: 0.4, neck: -1.2, armN: fk(84, 10), legN: foot(112) },
  ],
};

const frontRaise: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: STAND_HIP, torso: 0, armN: fk(6, 4), legN: foot(98) },
    { hip: STAND_HIP, torso: 0, armN: fk(90, 4), legN: foot(98) },
  ],
};

const uprightRow: MovementPattern = {
  view: 'front',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [100, 86], torso: 0, armN: fk(-4, -4), legN: foot(110) },
    { hip: [100, 86], torso: 0, armN: fk(96, -132), legN: foot(110) },
  ],
};

const shrug: MovementPattern = {
  view: 'front',
  tempo: 1000,
  pingpong: true,
  hold: 0.2,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [100, 86], torso: 0, armN: fk(4, 0), legN: foot(110) },
    { hip: [100, 86], torso: 0, torsoLen: 1.12, neck: 0.25, armN: fk(4, 0), legN: foot(110) },
  ],
};

const standingCurl = (prop: PropDef): MovementPattern => ({
  view: 'side',
  tempo: 1200,
  pingpong: true,
  props: [prop],
  frames: [
    { hip: STAND_HIP, torso: 0, armN: fk(0, 8), legN: foot(98) },
    { hip: STAND_HIP, torso: 0, armN: fk(8, 142), legN: foot(98) },
  ],
});

const preacherCurl: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  scene: [...floorSeat(66, 100, 116), { line: [100, 60, 122, 82], w: 6 }, { line: [116, 86, 112, 116], w: 3 }],
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [84, 110], torso: 12, armN: fk(40, 6), legN: SEATED_SIDE_LEGS },
    { hip: [84, 110], torso: 12, armN: fk(40, 118), legN: SEATED_SIDE_LEGS },
  ],
};

const inclineCurl: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  scene: [{ line: [82, 118, 54, 78], w: 7 }, ...floorSeat(78, 108, 120)],
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [92, 112], torso: -36, armN: fk(-2, 4), legN: foot(132, F) },
    { hip: [92, 112], torso: -36, armN: fk(-2, 140), legN: foot(132, F) },
  ],
};

const pushdown: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [118, -16] }],
  frames: [
    { hip: [92, 86], torso: 10, armN: fk(-4, 104), legN: foot(98) },
    { hip: [92, 86], torso: 10, armN: fk(-4, 4), legN: foot(98) },
  ],
};

const overheadExtension: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: STAND_HIP, torso: 0, armN: fk(168, 4), legN: foot(98) },
    { hip: STAND_HIP, torso: 0, armN: fk(168, 132), legN: foot(98) },
  ],
};

const skullCrusher: MovementPattern = {
  facing: -1,
  view: 'side',
  tempo: 1300,
  pingpong: true,
  feet: -1,
  scene: FLAT_BENCH,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [70, 106], torso: 90, armN: fk(166, 4), legN: benchLegs },
    { hip: [70, 106], torso: 90, armN: fk(166, -132), legN: benchLegs },
  ],
};

const legPress: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  scene: [{ line: [40, 132, 80, 92], w: 7 }, { line: [50, 136, 90, 136], w: 6 }, { line: [70, 140, 70, F], w: 3 }],
  props: [{ kind: 'platform', angle: 45 }],
  frames: [
    { hip: [70, 128], torso: -50, armN: fk(30, 0), legN: foot(98, 92, 1) },
    { hip: [70, 128], torso: -50, armN: fk(30, 0), legN: foot(114, 76, 1) },
  ],
};

const SEAT_MACHINE: SceneDef[] = [...floorSeat(62, 100, 113), { line: [62, 112, 58, 62], w: 6 }];
const legExtension: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  scene: SEAT_MACHINE,
  props: [{ kind: 'pad', at: 'ankleN' }],
  frames: [
    { hip: [76, 108], torso: -4, armN: fk(12, 0), legN: fk(90, -88) },
    { hip: [76, 108], torso: -4, armN: fk(12, 0), legN: fk(90, -6) },
  ],
};

const seatedLegCurl: MovementPattern = {
  ...legExtension,
  frames: [
    { hip: [76, 108], torso: -4, armN: fk(12, 0), legN: fk(90, -6) },
    { hip: [76, 108], torso: -4, armN: fk(12, 0), legN: fk(90, -112) },
  ],
};

const lyingLegCurl: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  feet: -1,
  scene: [{ line: [24, 128, 150, 128], w: 7 }, { line: [36, 132, 36, F], w: 3 }, { line: [140, 132, 140, F], w: 3 }],
  props: [{ kind: 'pad', at: 'ankleN' }],
  frames: [
    { hip: [86, 120], torso: 90, armN: fk(90, 0), legN: fk(-90, 0) },
    { hip: [86, 120], torso: 90, armN: fk(90, 0), legN: fk(-90, -104) },
  ],
};

const SPLIT_BENCH: SceneDef[] = [{ line: [26, 116, 64, 116], w: 7 }, { line: [34, 120, 34, F], w: 3 }, { line: [56, 120, 56, F], w: 3 }];
const bulgarian: MovementPattern = {
  view: 'side',
  tempo: 1300,
  pingpong: true,
  scene: SPLIT_BENCH,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [86, 88], torso: 8, armN: HANG, legN: foot(112), legF: foot(52, 111) },
    { hip: [82, 116], torso: 14, armN: HANG, legN: foot(112), legF: foot(52, 111) },
  ],
};

const walkingLunge: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [86, 86], torso: 2, armN: HANG, legN: foot(90), legF: foot(84) },
    { hip: [96, 117], torso: 6, armN: HANG, legN: foot(126), legF: foot(62, F) },
  ],
};

const calfRaise: MovementPattern = {
  view: 'side',
  tempo: 900,
  pingpong: true,
  hold: 0.25,
  props: [{ kind: 'pad', at: 'shoulder' }],
  scene: [{ line: [88, F - 2, 124, F - 2], w: 4 }],
  frames: [
    { hip: [99, 85], torso: 0, armN: fkRel(40, 130), legN: foot(100, F - 4), toeN: [109, F - 4] },
    { hip: [101, 77], torso: 0, armN: fkRel(40, 130), legN: foot(103, F - 12), toeN: [110, F - 5] },
  ],
};

const seatedCalfRaise: MovementPattern = {
  view: 'side',
  tempo: 900,
  pingpong: true,
  hold: 0.25,
  scene: [...floorSeat(58, 96, 116)],
  props: [{ kind: 'pad', at: 'kneeN' }],
  frames: [
    { hip: [80, 110], torso: 0, armN: fk(40, 40), legN: foot(112, F - 2), toeN: [121, F - 2] },
    { hip: [80, 110], torso: 0, armN: fk(40, 40), legN: foot(114, F - 9), toeN: [122, F - 3] },
  ],
};

const HIP_THRUST_BENCH: SceneDef[] = [{ line: [114, 112, 160, 112], w: 7 }, { line: [124, 116, 124, F], w: 3 }, { line: [152, 116, 152, F], w: 3 }];
const hipThrust: MovementPattern = {
  facing: -1,
  view: 'side',
  tempo: 1200,
  pingpong: true,
  hold: 0.18,
  feet: -1,
  scene: HIP_THRUST_BENCH,
  props: [{ kind: 'barbell', at: 'hip', offset: [2, -8] }],
  frames: [
    { hip: hipUnder([120, 104], 38), torso: 38, armN: fkRel(-12, 6), legN: foot(46, F, -1) },
    { hip: hipUnder([120, 104], 90), torso: 90, armN: fkRel(-12, 6), legN: foot(46, F, -1) },
  ],
};

const gluteBridge: MovementPattern = {
  facing: -1,
  view: 'side',
  tempo: 1100,
  pingpong: true,
  hold: 0.2,
  feet: -1,
  frames: [
    { hip: [92, 145], torso: 90, armN: fk(-90, 0), legN: foot(58, F, -1) },
    { hip: hipUnder([136, 145], 122), torso: 122, head: -32, armN: fk(-90, 0), legN: foot(58, F, -1) },
  ],
};

const cableKickback: MovementPattern = {
  view: 'side',
  tempo: 1100,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [160, F - 4], from: 'ankle' }],
  scene: [{ line: [150, 40, 150, F], w: 4 }],
  frames: [
    { hip: [96, 86], torso: 22, armN: hand(146, 62), legN: fk(6, -6), legF: foot(98) },
    { hip: [96, 86], torso: 22, armN: hand(146, 62), legN: fk(-46, -10), legF: foot(98) },
  ],
};

const hipAbduction: MovementPattern = {
  view: 'front',
  tempo: 1100,
  pingpong: true,
  scene: SEATED_FRONT_SCENE,
  props: [{ kind: 'pad', at: 'kneeN' }],
  frames: [
    { hip: [100, 106], torso: 0, armN: fk(12, 0), legN: fk(8, -8, [0.7, 1]) },
    { hip: [100, 106], torso: 0, armN: fk(12, 0), legN: fk(62, -62, [0.7, 1]) },
  ],
};

const plank: MovementPattern = {
  view: 'side',
  tempo: 1600,
  pingpong: true,
  hold: 0.25,
  frames: [
    { hip: hipUnder([130, 123], 74), torso: 74, armN: fk(0, 90), legN: foot(26, F - 2) },
    { hip: hipUnder([130, 122], 73), torso: 73, armN: fk(0, 90), legN: foot(26, F - 2) },
  ],
};

const crunch: MovementPattern = {
  facing: -1,
  view: 'side',
  tempo: 1000,
  pingpong: true,
  hold: 0.2,
  feet: -1,
  frames: [
    { hip: [82, 145], torso: 90, armN: fkRel(-40, -130), legN: foot(52, F, -1) },
    { hip: [82, 145], torso: 62, armN: fkRel(-40, -130), legN: foot(52, F, -1) },
  ],
};

const cableCrunch: MovementPattern = {
  view: 'side',
  tempo: 1200,
  pingpong: true,
  props: [{ kind: 'cable', anchor: [118, -16] }],
  frames: [
    { hip: [96, 117], torso: 14, armN: fkRel(150, 120), legN: fk(0, -90) },
    { hip: [92, 117], torso: 78, armN: fkRel(150, 120), legN: fk(14, -100) },
  ],
};

const twistLegs = fk(30, -30, [0.5, 0.9]);
const russianTwist: MovementPattern = {
  view: 'front',
  tempo: 900,
  pingpong: true,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [100, 136], torso: -16, torsoLen: 0.85, armN: hand(66, 126, -1), armF: hand(66, 126, 1), legN: twistLegs },
    { hip: [100, 136], torso: 16, torsoLen: 0.85, armN: hand(134, 126, -1), armF: hand(134, 126, 1), legN: twistLegs },
  ],
};

const abWheel: MovementPattern = {
  view: 'side',
  tempo: 1500,
  pingpong: true,
  props: [{ kind: 'wheel' }],
  frames: [
    { hip: [66, 116], torso: 40, armN: hand(104, 142), legN: foot(36, 140, -1) },
    { hip: [84, 128], torso: 78, armN: hand(150, 142), legN: foot(36, 140, -1) },
  ],
};

const run = (stride: number, bob: number): Pose[] => [
  { hip: [96, 86], torso: 8, armN: fk(-34, 84), armF: fk(34, 84), legN: fk(stride, -24), legF: fk(-stride * 0.8, -70) },
  { hip: [96, 86 - bob], torso: 8, armN: fk(34, 84), armF: fk(-34, 84), legN: fk(-stride * 0.8, -70), legF: fk(stride, -24) },
];
const treadmill: MovementPattern = {
  view: 'side',
  tempo: 420,
  pingpong: true,
  hold: 0,
  scene: [{ line: [34, F, 160, F], w: 6 }, { line: [156, F, 146, 84], w: 3 }, { line: [146, 84, 124, 84], w: 3 }],
  frames: run(34, 3),
};

const walk = (stride: number): Pose[] => [
  { hip: [96, 87], torso: 0, armN: HANG, legN: fk(stride, -6), legF: fk(-stride, -18) },
  { hip: [96, 85], torso: 0, armN: HANG, legN: fk(-stride, -18), legF: fk(stride, -6) },
];
const farmersWalk: MovementPattern = {
  view: 'side',
  tempo: 650,
  pingpong: true,
  hold: 0,
  props: [{ kind: 'dumbbell' }],
  frames: walk(20),
};

const RAIL: SceneDef[] = [{ line: [14, 142, 156, 142], w: 4 }, { line: [150, 112, 150, 142], w: 5 }, { circle: [160, 116, 10] }];
const rower: MovementPattern = {
  view: 'side',
  tempo: 650,
  hold: 0.05,
  scene: RAIL,
  props: [{ kind: 'cable', anchor: [158, 114] }],
  frames: [
    // Catch → legs drive → body swings back and arms pull → arms away → body over → knees bend.
    { hip: [80, 134], torso: 28, armN: hand(136, 112), legN: foot(144, 138, 1) },
    { hip: [56, 134], torso: 20, armN: hand(116, 112), legN: foot(144, 138, 1) },
    { hip: [46, 134], torso: -20, armN: hand(70, 106), legN: foot(144, 138, 1) },
    { hip: [46, 134], torso: -18, armN: hand(96, 112), legN: foot(144, 138, 1) },
    { hip: [48, 134], torso: 24, armN: hand(112, 114), legN: foot(144, 138, 1) },
  ],
};

const pedal = (deg: number): Vec => [112 + 13 * Math.sin(rad(deg)), 128 - 13 * Math.cos(rad(deg))];
const bikeFrame = (deg: number): Pose => ({
  hip: [80, 82],
  torso: 34,
  armN: hand(132, 66),
  legN: foot(...pedal(deg)),
  legF: foot(...pedal(deg + 180)),
});
const bike: MovementPattern = {
  view: 'side',
  tempo: 220,
  hold: 0,
  scene: [
    { line: [70, 90, 90, 90], w: 6 },
    { line: [80, 92, 112, 128], w: 4 },
    { line: [112, 128, 136, 68], w: 4 },
    { line: [80, 92, 80, F], w: 4 },
    { line: [60, F, 150, F], w: 5 },
    { circle: [112, 128, 13] },
  ],
  frames: [0, 60, 120, 180, 240, 300].map(bikeFrame),
};

const jumpRope: MovementPattern = {
  view: 'front',
  tempo: 380,
  hold: 0,
  props: [{ kind: 'rope' }],
  frames: [
    { hip: [100, 86], torso: 0, armN: fk(28, 40), legN: foot(106), rope: -10 },
    { hip: [100, 82], torso: 0, armN: fk(28, 40), legN: foot(106, F - 4), rope: 82 },
    { hip: [100, 78], torso: 0, armN: fk(28, 40), legN: foot(106, F - 8), rope: 170 },
    { hip: [100, 84], torso: 0, armN: fk(28, 40), legN: foot(106, F - 2), rope: 82 },
  ],
};

const STAIRS: SceneDef[] = [
  { line: [60, F, 150, F], w: 4 },
  { line: [104, 128, 150, 128], w: 4 },
  { line: [104, 128, 104, F], w: 3 },
  { line: [150, 70, 150, F], w: 3 },
];
const stairClimber: MovementPattern = {
  view: 'side',
  tempo: 700,
  pingpong: true,
  hold: 0.05,
  scene: STAIRS,
  frames: [
    { hip: [90, 84], torso: 6, armN: fk(-20, 40), armF: fk(20, 40), legN: foot(114, 126), legF: foot(92) },
    { hip: [98, 72], torso: 6, armN: fk(20, 40), armF: fk(-20, 40), legN: foot(114, 126), legF: foot(108, 132) },
  ],
};

const burpee: MovementPattern = {
  view: 'side',
  tempo: 520,
  hold: 0.08,
  frames: [
    { hip: STAND_HIP, torso: 0, armN: hand(100, 94), legN: foot(98) },
    { hip: [86, 122], torso: 46, armN: hand(122, F - 1), legN: foot(98) },
    { hip: [92, 118], torso: 62, armN: hand(130, F - 1), legN: foot(36, F - 2) },
    { hip: [86, 122], torso: 46, armN: hand(122, F - 1), legN: foot(98) },
    { hip: [96, 72], torso: 0, armN: hand(98, -14), legN: foot(98, F - 14) },
  ],
};

const kbSwing: MovementPattern = {
  view: 'side',
  tempo: 650,
  pingpong: true,
  hold: 0.05,
  props: [{ kind: 'kettlebell' }],
  frames: [
    { hip: [80, 92], torso: 62, armN: fk(-22, 0), legN: foot(100) },
    { hip: STAND_HIP, torso: -4, armN: fk(86, 0), legN: foot(100) },
  ],
};

const cleanPress: MovementPattern = {
  view: 'side',
  tempo: 750,
  hold: 0.12,
  props: [{ kind: 'barbell' }],
  frames: [
    { hip: [76, 106], torso: 60, armN: hand(103, 137), legN: foot(100) },
    { hip: [94, 92], torso: 6, armN: hand(108, 40), legN: foot(100) },
    { hip: STAND_HIP, torso: 0, armN: hand(98, -6), legN: foot(100) },
    { hip: [94, 92], torso: 6, armN: hand(108, 40), legN: foot(100) },
  ],
};

const thruster: MovementPattern = {
  view: 'side',
  tempo: 900,
  pingpong: true,
  hold: 0.1,
  props: [{ kind: 'dumbbell' }],
  frames: [
    { hip: [82, 120], torso: 18, armN: relHand(8, -4), legN: foot(101) },
    { hip: [97, 86], torso: 0, armN: relHand(2, -49), legN: foot(101) },
  ],
};

export const PATTERNS = {
  squatBack,
  squatFront,
  squatGoblet,
  hackSquat,
  deadlift,
  rdl,
  sumoDeadlift,
  benchPress,
  benchPressDb,
  closeGripBench,
  inclinePress: incline({ kind: 'barbell' }),
  inclinePressDb: incline({ kind: 'dumbbell' }),
  dbFly,
  cableFly,
  pecDeck,
  chestPressMachine,
  pushUp,
  chestDip: dip(26),
  tricepsDip: dip(4),
  benchDip,
  pullUp,
  hangingLegRaise,
  latPulldown,
  straightArmPulldown,
  facePull,
  barbellRow,
  dbRow,
  seatedRow,
  backExtension,
  overheadPress,
  dbShoulderPress,
  arnoldPress,
  lateralRaise,
  cableLateralRaise,
  rearDeltFly,
  frontRaise,
  uprightRow,
  shrug,
  barbellCurl: standingCurl({ kind: 'barbell' }),
  dbCurl: standingCurl({ kind: 'dumbbell' }),
  cableCurl: standingCurl({ kind: 'cable', anchor: [128, F - 2] }),
  preacherCurl,
  inclineCurl,
  pushdown,
  overheadExtension,
  skullCrusher,
  legPress,
  legExtension,
  seatedLegCurl,
  lyingLegCurl,
  bulgarian,
  walkingLunge,
  calfRaise,
  seatedCalfRaise,
  hipThrust,
  gluteBridge,
  cableKickback,
  hipAbduction,
  plank,
  crunch,
  cableCrunch,
  russianTwist,
  abWheel,
  treadmill,
  rower,
  bike,
  jumpRope,
  stairClimber,
  burpee,
  kbSwing,
  cleanPress,
  thruster,
  farmersWalk,
} satisfies Record<string, MovementPattern>;

export type PatternId = keyof typeof PATTERNS;
