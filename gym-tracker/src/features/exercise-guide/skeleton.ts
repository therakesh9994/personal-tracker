/**
 * Pose model and solver for the animated exercise figures.
 *
 * A figure is a stick skeleton drawn in a fixed 200 × 172 viewBox (see VIEW). An animation
 * is a loop of keyframe poses; the solver interpolates two poses and resolves joint
 * positions. Every function here is a Reanimated worklet so it can run on the UI thread,
 * and is also plain TypeScript so it can be unit-tested in Node.
 *
 * Coordinates: x grows right, y grows down, floor at y = FLOOR.
 * Angles are degrees. dir(0) points straight down, dir(90) points +x (the way a side-view
 * figure faces, or outward for the right-hand limbs of a front-view figure), dir(180) up.
 */

export type Vec = [number, number];

/** A limb (arm or leg) solved either from a target point (IK) or from two angles (FK). */
export type Limb =
  | {
      /** Target for the hand/ankle. Absolute, or relative to the limb root when `rel` is 1. */
      ik: Vec;
      /** Which side of the root→target line the elbow/knee goes. 1 or -1. */
      bend: number;
      rel?: number;
      /** Segment length multipliers (foreshortening). */
      len?: Vec;
    }
  | {
      /** [upper segment absolute angle, lower segment angle relative to upper]. */
      fk: Vec;
      /** 1 = upper angle is measured relative to the torso instead of the screen. */
      rel?: number;
      len?: Vec;
    };

export interface Pose {
  /** Pelvis centre. */
  hip: Vec;
  /** Side view: forward lean from vertical. Front view: sideways tilt. */
  torso: number;
  /** Torso length multiplier (foreshortening, shoulder shrug). Default 1. */
  torsoLen?: number;
  /** Neck length multiplier, may be negative to drop the head toward the shoulders. Default 1. */
  neck?: number;
  /** Extra rotation of the head direction relative to the torso, degrees. */
  head?: number;
  /** Near arm (side view) or right arm (front view). */
  armN: Limb;
  /** Far / left arm. Omitted: mirrors the near arm. */
  armF?: Limb;
  legN: Limb;
  legF?: Limb;
  /** Explicit toe positions (side view), e.g. for calf raises. */
  toeN?: Vec;
  toeF?: Vec;
  /** Jump rope: y of the rope's control point. */
  rope?: number;
}

export type View = 'side' | 'front';

export interface Skeleton {
  hip: Vec;
  shoulder: Vec;
  neck: Vec;
  head: Vec;
  /** Front view only: shoulder and hip joint positions either side of the centre line. */
  shoulderN: Vec;
  shoulderF: Vec;
  hipN: Vec;
  hipF: Vec;
  elbowN: Vec;
  handN: Vec;
  elbowF: Vec;
  handF: Vec;
  kneeN: Vec;
  ankleN: Vec;
  toeN: Vec;
  kneeF: Vec;
  ankleF: Vec;
  toeF: Vec;
  rope: number;
}

export const FLOOR = 150;
export const VIEW = { x: 0, y: -16, w: 200, h: 172 } as const;

export const LEN = {
  torso: 44,
  neck: 7,
  headR: 9,
  upperArm: 26,
  forearm: 24,
  thigh: 33,
  shin: 32,
  foot: 9,
  shoulderHalf: 13,
  hipHalf: 8,
} as const;

const DEG = Math.PI / 180;

export function dir(deg: number, mirror: number): Vec {
  'worklet';
  return [Math.sin(deg * DEG) * mirror, Math.cos(deg * DEG)];
}

function add(a: Vec, b: Vec, s: number): Vec {
  'worklet';
  return [a[0] + b[0] * s, a[1] + b[1] * s];
}

/** Two-bone inverse kinematics. Returns [joint, end]; unreachable targets are clamped. */
export function solveIk(root: Vec, target: Vec, l1: number, l2: number, bend: number): [Vec, Vec] {
  'worklet';
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const raw = Math.sqrt(dx * dx + dy * dy);
  const minD = Math.abs(l1 - l2) + 0.01;
  const maxD = l1 + l2 - 0.01;
  const d = Math.min(maxD, Math.max(minD, raw));
  const theta = raw > 1e-6 ? Math.atan2(dy, dx) : Math.PI / 2;
  const side = bend < 0 ? -1 : 1; // interpolated bends must not pass through 0
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const j: Vec = [root[0] + l1 * Math.cos(theta - side * a), root[1] + l1 * Math.sin(theta - side * a)];
  const e: Vec = [root[0] + d * Math.cos(theta), root[1] + d * Math.sin(theta)];
  return [j, e];
}

/**
 * Solve one limb. `mirror` is -1 for the left limbs of a front-view figure: FK angles and
 * relative IK targets are reflected, so "outward" stays outward on both sides.
 */
export function solveLimb(limb: Limb, root: Vec, l1: number, l2: number, torso: number, mirror: number): [Vec, Vec] {
  'worklet';
  const s1 = limb.len ? limb.len[0] : 1;
  const s2 = limb.len ? limb.len[1] : 1;
  if ('fk' in limb) {
    const a1 = limb.fk[0] - (limb.rel ? torso : 0);
    const j = add(root, dir(a1, mirror), l1 * s1);
    const e = add(j, dir(a1 + limb.fk[1], mirror), l2 * s2);
    return [j, e];
  }
  const target: Vec = limb.rel ? [root[0] + limb.ik[0] * mirror, root[1] + limb.ik[1]] : limb.ik;
  return solveIk(root, target, l1 * s1, l2 * s2, limb.bend * mirror);
}

function mirrorLimb(limb: Limb, cx: number): Limb {
  'worklet';
  // Front view: an absolute IK target is reflected across the body's centre line.
  // FK and relative targets are reflected inside solveLimb via `mirror`.
  if ('ik' in limb && !limb.rel) return { ik: [2 * cx - limb.ik[0], limb.ik[1]], bend: limb.bend, len: limb.len, rel: 0 };
  return limb;
}

function toeFor(knee: Vec, ankle: Vec, feet: number): Vec {
  'worklet';
  const dx = ankle[0] - knee[0];
  const dy = ankle[1] - knee[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular to the shin, pointing the way the figure faces (feet = 1) or behind (-1).
  return [ankle[0] + (dy / l) * LEN.foot * feet, ankle[1] - (dx / l) * LEN.foot * feet];
}

/** Resolve every joint for a pose. */
export function solvePose(p: Pose, view: View, feet: number): Skeleton {
  'worklet';
  const torsoLen = p.torsoLen ?? 1;
  const neckLen = p.neck ?? 1;
  const up = dir(180 - p.torso, 1); // (sin t, -cos t)
  const shoulder = add(p.hip, up, LEN.torso * torsoLen);
  const headDir = dir(180 - p.torso - (p.head ?? 0), 1);
  const neck = add(shoulder, headDir, LEN.neck * neckLen);
  const head = add(neck, headDir, LEN.headR);

  let shoulderN = shoulder;
  let shoulderF = shoulder;
  let hipN = p.hip;
  let hipF = p.hip;
  let mirrorF = 1;
  let armF = p.armF ?? p.armN;
  let legF = p.legF ?? p.legN;
  if (view === 'front') {
    const right: Vec = [up[1] * -1, up[0]]; // perpendicular to the torso, pointing +x when upright
    shoulderN = add(shoulder, right, LEN.shoulderHalf);
    shoulderF = add(shoulder, right, -LEN.shoulderHalf);
    hipN = add(p.hip, right, LEN.hipHalf);
    hipF = add(p.hip, right, -LEN.hipHalf);
    mirrorF = -1;
    if (!p.armF) armF = mirrorLimb(p.armN, p.hip[0]);
    if (!p.legF) legF = mirrorLimb(p.legN, p.hip[0]);
  }
  // An explicitly given far limb with an absolute target is used as-is (both views).
  const armMirror = p.armF && 'ik' in p.armF && !p.armF.rel ? 1 : mirrorF;
  const legMirror = p.legF && 'ik' in p.legF && !p.legF.rel ? 1 : mirrorF;

  const [elbowN, handN] = solveLimb(p.armN, shoulderN, LEN.upperArm, LEN.forearm, p.torso, 1);
  const [elbowF, handF] = solveLimb(armF, shoulderF, LEN.upperArm, LEN.forearm, p.torso, armMirror);
  const [kneeN, ankleN] = solveLimb(p.legN, hipN, LEN.thigh, LEN.shin, p.torso, 1);
  const [kneeF, ankleF] = solveLimb(legF, hipF, LEN.thigh, LEN.shin, p.torso, legMirror);

  let toeN: Vec;
  let toeF: Vec;
  if (view === 'front') {
    toeN = [ankleN[0] + 5, ankleN[1]];
    toeF = [ankleF[0] - 5, ankleF[1]];
  } else {
    toeN = p.toeN ?? toeFor(kneeN, ankleN, feet);
    toeF = p.toeF ?? (p.legF ? toeFor(kneeF, ankleF, feet) : toeN);
  }

  return {
    hip: p.hip,
    shoulder,
    neck,
    head,
    shoulderN,
    shoulderF,
    hipN,
    hipF,
    elbowN,
    handN,
    elbowF,
    handF,
    kneeN,
    ankleN,
    toeN,
    kneeF,
    ankleF,
    toeF,
    rope: p.rope ?? 0,
  };
}

/** Interpolate two poses of the same shape (numbers and arrays of numbers, recursively). */
export function lerpTree<T>(a: T, b: T, u: number): T {
  'worklet';
  if (typeof a === 'number') return (a + ((b as number) - a) * u) as T;
  if (Array.isArray(a)) {
    const out: unknown[] = [];
    for (let i = 0; i < a.length; i++) out.push(lerpTree(a[i], (b as unknown[])[i], u));
    return out as T;
  }
  if (a && typeof a === 'object') {
    const out: Record<string, unknown> = {};
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    for (const k in ao) out[k] = bo[k] === undefined ? ao[k] : lerpTree(ao[k], bo[k], u);
    return out as T;
  }
  return a;
}

/** Ease with a short hold at each keyframe so the start and end positions read clearly. */
export function easeSegment(u: number, hold: number): number {
  'worklet';
  const v = Math.min(1, Math.max(0, (u - hold) / (1 - 2 * hold)));
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

/**
 * Pose at time `t` ∈ [0, frames.length) along a looping keyframe sequence
 * (the last frame blends back into the first).
 */
export function poseAt(frames: Pose[], t: number, hold: number): Pose {
  'worklet';
  const n = frames.length;
  if (n === 1) return frames[0];
  const wrapped = ((t % n) + n) % n;
  const i = Math.floor(wrapped);
  const u = easeSegment(wrapped - i, hold);
  return lerpTree(frames[i], frames[(i + 1) % n], u);
}
