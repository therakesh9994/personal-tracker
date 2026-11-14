import type { MovementPattern, PropDef, SceneDef } from './patterns';
import { dir, FLOOR, LEN, type Skeleton, type Vec } from './skeleton';

/**
 * Turns a solved skeleton into an anatomical figure: fleshed-out body segments with
 * muscle groups drawn on top, the working muscles highlighted.
 *
 * The list of items (order, kind, role) depends only on the pattern and the highlighted
 * muscles, never on the pose, so the renderer mounts one animated SVG element per item
 * and only updates its geometry each frame.
 */

export const MUSCLES = [
  'pecs',
  'delts',
  'biceps',
  'triceps',
  'forearms',
  'lats',
  'traps',
  'lowerBack',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_NAMES: Record<Muscle, string> = {
  pecs: 'Chest',
  delts: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  traps: 'Traps',
  lowerBack: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
};

export interface MuscleTargets {
  primary: Muscle[];
  secondary: Muscle[];
}

export type Role =
  | 'scene'
  | 'equip'
  | 'equipFill'
  | 'cable'
  | 'skin'
  | 'skinFar'
  | 'muscle'
  | 'primary'
  | 'secondary'
  | 'primaryFar'
  | 'secondaryFar';

export interface DrawItem {
  /** l = line [x1, y1, x2, y2], c = circle [cx, cy, r], p = stroked path, f = filled shape (path). */
  k: 'l' | 'c' | 'p' | 'f';
  role: Role;
  w: number;
  v: number[];
  d?: string;
}

export interface DrawConfig {
  view: 'side' | 'front';
  /** Side view: 1 when the figure's front faces the way its torso leans, -1 when lying face up. */
  facing: number;
  scene: SceneDef[];
  props: PropDef[];
  primary: Muscle[];
  secondary: Muscle[];
}

export function drawConfig(p: MovementPattern, muscles: MuscleTargets): DrawConfig {
  return { view: p.view, facing: p.facing ?? 1, scene: p.scene ?? [], props: p.props ?? [], primary: muscles.primary, secondary: muscles.secondary };
}

// Segment radii (half-thickness) at the start and end of each segment.
const R = {
  upperArm: [4.6, 3.6],
  forearm: [3.4, 2.5],
  thigh: [7.4, 4.8],
  shin: [4.8, 3],
  foot: [2.5, 2.2],
  neck: [3.4, 3.4],
  hand: 3,
} as const;

// ---------------------------------------------------------------------------
// Geometry helpers (worklets)
// ---------------------------------------------------------------------------

function f1(n: number): string {
  'worklet';
  return (Math.round(n * 10) / 10).toString();
}

function at(a: Vec, b: Vec, t: number): Vec {
  'worklet';
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function unit(a: Vec, b: Vec): Vec {
  'worklet';
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  return [dx / l, dy / l];
}

/** Rounded, tapered segment from a (radius r1) to b (radius r2). */
function capsule(a: Vec, b: Vec, r1: number, r2: number): string {
  'worklet';
  const d = unit(a, b);
  const n: Vec = [d[1], -d[0]];
  const p = (c: Vec, s: number, r: number, along: number): string => `${f1(c[0] + n[0] * r * s + d[0] * along)} ${f1(c[1] + n[1] * r * s + d[1] * along)}`;
  return (
    `M ${p(a, 1, r1, 0)} L ${p(b, 1, r2, 0)} ` +
    `Q ${p(b, 1, r2, r2 * 1.05)} ${p(b, 0, 0, r2)} Q ${p(b, -1, r2, r2 * 1.05)} ${p(b, -1, r2, 0)} ` +
    `L ${p(a, -1, r1, 0)} Q ${p(a, -1, r1, -r1 * 1.05)} ${p(a, 0, 0, -r1)} Q ${p(a, 1, r1, -r1 * 1.05)} ${p(a, 1, r1, 0)} Z`
  );
}

/**
 * Muscle belly along a segment between t0 and t1. side = 1 / -1 puts it on one face of
 * the segment (bulging outward by `bulge`), side = 0 centres it.
 */
function lens(a: Vec, b: Vec, t0: number, t1: number, r: number, side: number, bulge: number): string {
  'worklet';
  const d = unit(a, b);
  const n: Vec = [d[1] * side, -d[0] * side];
  const m = at(a, b, (t0 + t1) / 2);
  if (side === 0) {
    const pn: Vec = [d[1], -d[0]];
    const p0 = at(a, b, t0);
    const p1 = at(a, b, t1);
    return `M ${f1(p0[0])} ${f1(p0[1])} Q ${f1(m[0] + pn[0] * 2 * bulge)} ${f1(m[1] + pn[1] * 2 * bulge)} ${f1(p1[0])} ${f1(p1[1])} Q ${f1(m[0] - pn[0] * 2 * bulge)} ${f1(m[1] - pn[1] * 2 * bulge)} ${f1(p0[0])} ${f1(p0[1])} Z`;
  }
  const s0 = at(a, b, t0);
  const s1 = at(a, b, t1);
  const p0: Vec = [s0[0] + n[0] * r * 0.3, s0[1] + n[1] * r * 0.3];
  const p1: Vec = [s1[0] + n[0] * r * 0.3, s1[1] + n[1] * r * 0.3];
  // Keep the belly inside the silhouette: it peaks just past the surface by `bulge`.
  const outer = 2 * (r * 0.9 + bulge) - r * 0.3;
  const inner = r * 0.05;
  return `M ${f1(p0[0])} ${f1(p0[1])} Q ${f1(m[0] + n[0] * outer)} ${f1(m[1] + n[1] * outer)} ${f1(p1[0])} ${f1(p1[1])} Q ${f1(m[0] + n[0] * inner)} ${f1(m[1] + n[1] * inner)} ${f1(p0[0])} ${f1(p0[1])} Z`;
}

/** Ellipse centred at c, with radius rx along `axis` and ry across it. */
function ellipse(c: Vec, axis: Vec, rx: number, ry: number): string {
  'worklet';
  const ang = (Math.atan2(axis[1], axis[0]) * 180) / Math.PI;
  const x0 = c[0] - axis[0] * rx;
  const y0 = c[1] - axis[1] * rx;
  const x1 = c[0] + axis[0] * rx;
  const y1 = c[1] + axis[1] * rx;
  return `M ${f1(x0)} ${f1(y0)} A ${f1(rx)} ${f1(ry)} ${f1(ang)} 1 0 ${f1(x1)} ${f1(y1)} A ${f1(rx)} ${f1(ry)} ${f1(ang)} 1 0 ${f1(x0)} ${f1(y0)} Z`;
}

/** Smooth closed outline through points (quadratic curves between midpoints). */
function smoothClosed(pts: Vec[]): string {
  'worklet';
  const n = pts.length;
  const mid = (i: number): Vec => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const start = mid(n - 1);
  let d = `M ${f1(start[0])} ${f1(start[1])}`;
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    d += ` Q ${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`;
  }
  return d + ' Z';
}

function includes(list: Muscle[], m: Muscle): boolean {
  'worklet';
  for (let i = 0; i < list.length; i++) if (list[i] === m) return true;
  return false;
}

/** Role for a muscle, or null when it should not be drawn (far side, not worked). */
function muscleRole(cfg: DrawConfig, m: Muscle, far: boolean): Role | null {
  'worklet';
  if (includes(cfg.primary, m)) return far ? 'primaryFar' : 'primary';
  if (includes(cfg.secondary, m)) return far ? 'secondaryFar' : 'secondary';
  return far ? null : 'muscle';
}

function shape(out: DrawItem[], d: string, role: Role | null) {
  'worklet';
  if (role) out.push({ k: 'f', role, w: 0.6, v: [], d });
}

// ---------------------------------------------------------------------------
// Body parts
// ---------------------------------------------------------------------------

function sideLimbs(out: DrawItem[], sk: Skeleton, cfg: DrawConfig, near: boolean) {
  'worklet';
  const far = !near;
  const skin: Role = far ? 'skinFar' : 'skin';
  const s = cfg.facing; // anterior side of a limb segment
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.ankleN : sk.ankleF;
  const toe = near ? sk.toeN : sk.toeF;
  shape(out, capsule(hip, knee, R.thigh[0], R.thigh[1]), skin);
  shape(out, lens(hip, knee, 0.1, 0.9, 6.4, s, 0.7), muscleRole(cfg, 'quads', far));
  shape(out, lens(hip, knee, 0.18, 0.86, 6.2, -s, 0.5), muscleRole(cfg, 'hamstrings', far));
  shape(out, capsule(knee, ankle, R.shin[0], R.shin[1]), skin);
  shape(out, lens(knee, ankle, 0.06, 0.58, 4.4, -s, 1.1), muscleRole(cfg, 'calves', far));
  shape(out, capsule(ankle, toe, R.foot[0], R.foot[1]), skin);

  const sh = near ? sk.shoulderN : sk.shoulderF;
  const elbow = near ? sk.elbowN : sk.elbowF;
  const handP = near ? sk.handN : sk.handF;
  shape(out, capsule(sh, elbow, R.upperArm[0], R.upperArm[1]), skin);
  shape(out, lens(sh, elbow, 0.26, 0.9, 4.1, s, 0.7), muscleRole(cfg, 'biceps', far));
  shape(out, lens(sh, elbow, 0.16, 0.86, 4.1, -s, 0.5), muscleRole(cfg, 'triceps', far));
  shape(out, lens(sh, elbow, -0.18, 0.4, 0, 0, 5), muscleRole(cfg, 'delts', far));
  shape(out, capsule(elbow, handP, R.forearm[0], R.forearm[1]), skin);
  shape(out, lens(elbow, handP, 0.05, 0.6, 3.2, s, 0.4), muscleRole(cfg, 'forearms', far));
  out.push({ k: 'c', role: skin, w: 0, v: [handP[0], handP[1], R.hand] });
}

function sideTorso(out: DrawItem[], sk: Skeleton, cfg: DrawConfig) {
  'worklet';
  const a = sk.hip;
  const b = sk.shoulder;
  const d = unit(a, b);
  // Anterior normal: the side the chest faces.
  const n: Vec = [-d[1] * cfg.facing, d[0] * cfg.facing];
  const stations: [number, number, number][] = [
    // t along hip→shoulder, front offset, back offset
    [-0.06, 6.5, 8.5],
    [0.12, 7.5, 11],
    [0.38, 7, 7],
    [0.72, 11, 8.6],
    [0.96, 7.5, 7.4],
    [1.06, 4, 4],
  ];
  const pts: Vec[] = [];
  for (let i = 0; i < stations.length; i++) {
    const c = at(a, b, stations[i][0]);
    pts.push([c[0] + n[0] * stations[i][1], c[1] + n[1] * stations[i][1]]);
  }
  for (let i = stations.length - 1; i >= 0; i--) {
    const c = at(a, b, stations[i][0]);
    pts.push([c[0] - n[0] * stations[i][2], c[1] - n[1] * stations[i][2]]);
  }
  shape(out, smoothClosed(pts), 'skin');
  // lens() side 1 = (d.y, -d.x) = -n·facing, so the anterior side is -facing.
  const front = -cfg.facing;
  shape(out, lens(a, b, -0.08, 0.32, 9, -front, 1.4), muscleRole(cfg, 'glutes', false));
  shape(out, lens(a, b, 0.3, 0.56, 6, -front, 0.2), muscleRole(cfg, 'lowerBack', false));
  shape(out, lens(a, b, 0.46, 0.86, 7.6, -front, 0.6), muscleRole(cfg, 'lats', false));
  shape(out, lens(a, b, 0.84, 1.1, 6.4, -front, 0.6), muscleRole(cfg, 'traps', false));
  shape(out, lens(a, b, 0.12, 0.58, 6.8, front, 0.3), muscleRole(cfg, 'abs', false));
  shape(out, lens(a, b, 0.2, 0.52, 0, 0, 2.6), muscleRole(cfg, 'obliques', false));
  shape(out, lens(a, b, 0.58, 0.94, 10, front, 0.9), muscleRole(cfg, 'pecs', false));
}

function frontTorso(out: DrawItem[], sk: Skeleton, cfg: DrawConfig) {
  'worklet';
  const a = sk.hip;
  const b = sk.shoulder;
  const u = unit(a, b);
  const r: Vec = [-u[1], u[0]]; // toward the near (+x) side when upright
  const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) || 1;
  const P = (t: number, x: number): Vec => [a[0] + u[0] * len * t + r[0] * x, a[1] + u[1] * len * t + r[1] * x];
  const half: [number, number][] = [
    [-0.06, 11.5],
    [0.4, 11],
    [0.74, 15],
    [0.98, 17.5],
    [1.08, 6],
  ];
  const pts: Vec[] = [];
  for (let i = 0; i < half.length; i++) pts.push(P(half[i][0], half[i][1]));
  for (let i = half.length - 1; i >= 0; i--) pts.push(P(half[i][0], -half[i][1]));
  shape(out, smoothClosed(pts), 'skin');
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    shape(out, ellipse(P(1.0, sgn * 8.5), r, 5.5, 2.4), muscleRole(cfg, 'traps', false));
    shape(out, ellipse(P(0.6, sgn * 12.6), u, 8, 2.3), muscleRole(cfg, 'lats', false));
    shape(out, ellipse(P(0.38, sgn * 9.4), u, 6.5, 2.3), muscleRole(cfg, 'obliques', false));
    shape(out, ellipse(P(0.79, sgn * 6.8), r, 6.6, 4.4), muscleRole(cfg, 'pecs', false));
    shape(out, ellipse(P(0.02, sgn * 11), u, 4, 2.2), muscleRole(cfg, 'glutes', false));
  }
  shape(out, ellipse(P(0.36, 0), u, 10.5, 4.8), muscleRole(cfg, 'abs', false));
}

function frontLimbs(out: DrawItem[], sk: Skeleton, cfg: DrawConfig, near: boolean) {
  'worklet';
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.ankleN : sk.ankleF;
  const toe = near ? sk.toeN : sk.toeF;
  shape(out, capsule(hip, knee, R.thigh[0], R.thigh[1]), 'skin');
  shape(out, lens(hip, knee, 0.1, 0.88, 0, 0, 5.2), muscleRole(cfg, 'quads', false));
  shape(out, capsule(knee, ankle, R.shin[0], R.shin[1]), 'skin');
  shape(out, lens(knee, ankle, 0.08, 0.55, 0, 0, 3.2), muscleRole(cfg, 'calves', false));
  shape(out, capsule(ankle, toe, R.foot[0], R.foot[1]), 'skin');

  const sh = near ? sk.shoulderN : sk.shoulderF;
  const elbow = near ? sk.elbowN : sk.elbowF;
  const handP = near ? sk.handN : sk.handF;
  shape(out, capsule(sh, elbow, R.upperArm[0], R.upperArm[1]), 'skin');
  shape(out, lens(sh, elbow, 0.3, 0.88, 0, 0, 3), muscleRole(cfg, 'biceps', false));
  shape(out, capsule(elbow, handP, R.forearm[0], R.forearm[1]), 'skin');
  shape(out, lens(elbow, handP, 0.05, 0.6, 0, 0, 2.6), muscleRole(cfg, 'forearms', false));
  const ad = unit(sh, elbow);
  shape(out, ellipse([sh[0] + ad[0] * 2.5, sh[1] + ad[1] * 2.5], ad, 6, 4.6), muscleRole(cfg, 'delts', false));
  out.push({ k: 'c', role: 'skin', w: 0, v: [handP[0], handP[1], R.hand] });
}

function head(out: DrawItem[], sk: Skeleton) {
  'worklet';
  shape(out, capsule(sk.shoulder, sk.neck, R.neck[0], R.neck[1]), 'skin');
  out.push({ k: 'c', role: 'skin', w: 0, v: [sk.head[0], sk.head[1], LEN.headR - 0.6] });
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

function seg(out: DrawItem[], a: Vec, b: Vec, role: Role, w: number) {
  'worklet';
  out.push({ k: 'l', role, w, v: [a[0], a[1], b[0], b[1]] });
}

function circ(out: DrawItem[], c: Vec, r: number, role: Role, w: number) {
  'worklet';
  out.push({ k: 'c', role, w, v: [c[0], c[1], r] });
}

/** Equipment drawn behind the body (plates, cables, platforms). */
function propsBehind(out: DrawItem[], sk: Skeleton, cfg: DrawConfig) {
  'worklet';
  for (let i = 0; i < cfg.props.length; i++) {
    const p = cfg.props[i];
    if (p.kind === 'barbell') {
      if (cfg.view === 'front' && (p.at ?? 'hands') === 'hands') continue;
      const at2 = p.at ?? 'hands';
      const base = at2 === 'shoulder' ? sk.shoulder : at2 === 'hip' ? sk.hip : sk.handN;
      const o = p.offset ?? [0, 0];
      const c: Vec = [base[0] + o[0], base[1] + o[1]];
      circ(out, c, 12, 'equip', 3);
      circ(out, c, 2.5, 'equipFill', 0);
    } else if (p.kind === 'cable') {
      const from = p.from === 'ankle' ? sk.ankleN : sk.handN;
      seg(out, from, p.anchor, 'cable', 1.5);
      circ(out, p.anchor, 3, 'equipFill', 0);
      if (p.both) {
        const mirrored: Vec = [2 * sk.hip[0] - p.anchor[0], p.anchor[1]];
        seg(out, sk.handF, mirrored, 'cable', 1.5);
        circ(out, mirrored, 3, 'equipFill', 0);
      }
    } else if (p.kind === 'platform') {
      const d = dir(p.angle, 1);
      const c: Vec = [sk.ankleN[0] + d[1] * 4, sk.ankleN[1] - d[0] * 4];
      seg(out, [c[0] - d[0] * 16, c[1] - d[1] * 16], [c[0] + d[0] * 16, c[1] + d[1] * 16], 'equip', 6);
    } else if (p.kind === 'rope') {
      const ax = sk.handF[0];
      const ay = sk.handF[1];
      const bx = sk.handN[0];
      const by = sk.handN[1];
      const cy = 2 * sk.rope - (ay + by) / 2;
      out.push({ k: 'p', role: 'cable', w: 1.5, v: [], d: `M ${f1(ax)} ${f1(ay)} Q ${f1((ax + bx) / 2)} ${f1(cy)} ${f1(bx)} ${f1(by)}` });
    }
  }
}

/** Equipment held in the hands or pressed against the body, drawn in front. */
function propsFront(out: DrawItem[], sk: Skeleton, cfg: DrawConfig) {
  'worklet';
  for (let i = 0; i < cfg.props.length; i++) {
    const p = cfg.props[i];
    if (p.kind === 'barbell' && cfg.view === 'front' && (p.at ?? 'hands') === 'hands') {
      const y = (sk.handN[1] + sk.handF[1]) / 2;
      const l = Math.min(sk.handN[0], sk.handF[0]) - 22;
      const rr = Math.max(sk.handN[0], sk.handF[0]) + 22;
      seg(out, [l, y], [rr, y], 'equip', 3);
      seg(out, [l + 4, y - 11], [l + 4, y + 11], 'equip', 6);
      seg(out, [rr - 4, y - 11], [rr - 4, y + 11], 'equip', 6);
    } else if (p.kind === 'dumbbell') {
      if (cfg.view === 'front') {
        seg(out, [sk.handN[0], sk.handN[1] - 6], [sk.handN[0], sk.handN[1] + 6], 'equip', 7);
        seg(out, [sk.handF[0], sk.handF[1] - 6], [sk.handF[0], sk.handF[1] + 6], 'equip', 7);
      } else {
        circ(out, sk.handN, 5.5, 'equipFill', 0);
      }
    } else if (p.kind === 'kettlebell') {
      const c: Vec = [(sk.handN[0] + sk.handF[0]) / 2, (sk.handN[1] + sk.handF[1]) / 2 + 8];
      circ(out, c, 7, 'equipFill', 0);
    } else if (p.kind === 'pad') {
      const j = p.at === 'ankleN' ? sk.ankleN : p.at === 'kneeN' ? sk.kneeN : p.at === 'hip' ? sk.hip : sk.shoulder;
      circ(out, [j[0] + (p.at === 'ankleN' ? 6 : 0), j[1] + (p.at === 'kneeN' ? -7 : 0)], 5, 'equipFill', 0);
    } else if (p.kind === 'wheel') {
      circ(out, [sk.handN[0], sk.handN[1] + 1], 8, 'equip', 3);
      circ(out, [sk.handN[0], sk.handN[1] + 1], 2.5, 'equipFill', 0);
    }
  }
}

/** All drawing primitives for one frame, back to front. */
export function drawFrame(sk: Skeleton, cfg: DrawConfig): DrawItem[] {
  'worklet';
  const out: DrawItem[] = [];
  seg(out, [8, FLOOR + 1.5], [192, FLOOR + 1.5], 'scene', 2);
  for (let i = 0; i < cfg.scene.length; i++) {
    const s = cfg.scene[i];
    if ('line' in s) out.push({ k: 'l', role: 'scene', w: s.w ?? 3, v: [s.line[0], s.line[1], s.line[2], s.line[3]] });
    else out.push({ k: 'c', role: 'scene', w: 3, v: [s.circle[0], s.circle[1], s.circle[2]] });
  }
  propsBehind(out, sk, cfg);
  if (cfg.view === 'side') {
    sideLimbs(out, sk, cfg, false);
    sideTorso(out, sk, cfg);
    head(out, sk);
    sideLimbs(out, sk, cfg, true);
  } else {
    frontTorso(out, sk, cfg);
    head(out, sk);
    frontLimbs(out, sk, cfg, false);
    frontLimbs(out, sk, cfg, true);
  }
  propsFront(out, sk, cfg);
  return out;
}
