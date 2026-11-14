import { EXERCISE_LIBRARY } from '@/constants/exerciseLibrary';
import { drawConfig, drawFrame, MUSCLES } from '../drawing';
import { EXERCISE_GUIDES, getExerciseGuide } from '../guides';
import { loopFrames, PATTERNS, type PatternId } from '../patterns';
import { LEN, poseAt, solveIk, solvePose, type Limb, type Pose, type Vec } from '../skeleton';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Structural signature of a pose: keys and limb modes, ignoring numbers. */
function shape(p: Pose): string {
  const limb = (l?: Limb) => (l ? `${'ik' in l ? 'ik' : 'fk'}${l.rel ? 'r' : ''}${l.len ? 'L' : ''}` : '-');
  const keys = Object.keys(p).filter((k) => (p as unknown as Record<string, unknown>)[k] !== undefined).sort();
  return `${keys.join(',')}|${limb(p.armN)}|${limb(p.armF)}|${limb(p.legN)}|${limb(p.legF)}`;
}

describe('exercise guides', () => {
  it('covers every built-in exercise, and nothing else', () => {
    const libraryIds = EXERCISE_LIBRARY.map((e) => e.id).sort();
    expect(Object.keys(EXERCISE_GUIDES).sort()).toEqual(libraryIds);
  });

  it.each(Object.entries(EXERCISE_GUIDES))('%s has a valid pattern and complete content', (_id, g) => {
    expect(PATTERNS[g.pattern]).toBeDefined();
    expect(g.setup.length).toBeGreaterThan(0);
    expect(g.steps.length).toBeGreaterThan(0);
    expect(g.cues.length).toBeGreaterThan(0);
    expect(g.mistakes.length).toBeGreaterThan(0);
    expect(g.breathing.trim()).not.toBe('');
    for (const s of [...g.setup, ...g.steps, ...g.cues, ...g.mistakes]) expect(s.trim()).not.toBe('');
    expect(g.muscles.primary.length).toBeGreaterThan(0);
    for (const m of [...g.muscles.primary, ...g.muscles.secondary]) expect(MUSCLES).toContain(m);
  });

  it.each(Object.entries(EXERCISE_GUIDES))('%s highlights its primary muscles on the figure', (_id, g) => {
    const p = PATTERNS[g.pattern];
    const items = drawFrame(solvePose(loopFrames(p)[0], p.view, p.feet ?? 1), drawConfig(p, g.muscles));
    expect(items.some((i) => i.role === 'primary')).toBe(true);
  });

  it('returns null for custom or unknown exercises', () => {
    expect(getExerciseGuide('custom-uuid')).toBeNull();
    expect(getExerciseGuide('ex_bench_press')?.pattern).toBe('benchPress');
  });

  it('every pattern is used by at least one exercise', () => {
    const used = new Set(Object.values(EXERCISE_GUIDES).map((g) => g.pattern));
    const unused = (Object.keys(PATTERNS) as PatternId[]).filter((p) => !used.has(p));
    expect(unused).toEqual([]);
  });
});

describe('movement patterns', () => {
  it.each(Object.keys(PATTERNS) as PatternId[])('%s has consistent keyframes and stable drawing', (id) => {
    const p = PATTERNS[id];
    const frames = loopFrames(p);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(p.tempo).toBeGreaterThan(0);

    // Keyframes must have the same structure so they can be interpolated.
    const sig = shape(frames[0]);
    for (const f of frames) expect(shape(f)).toBe(sig);

    // The drawing item list (kind + role) must not change during the loop: the renderer
    // mounts one animated element per item.
    const cfg = drawConfig(p, { primary: ['pecs', 'quads'], secondary: ['calves'] });
    const layout = (t: number) => drawFrame(solvePose(poseAt(frames, t, p.hold ?? 0.12), p.view, p.feet ?? 1), cfg);
    const ref = layout(0).map((i) => `${i.k}:${i.role}:${i.w}`);
    for (let t = 0; t < frames.length; t += 0.25) {
      const items = layout(t);
      expect(items.map((i) => `${i.k}:${i.role}:${i.w}`)).toEqual(ref);
      for (const i of items) for (const v of i.v) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it.each(Object.keys(PATTERNS) as PatternId[])('%s keeps limb lengths constant (no stretching)', (id) => {
    const p = PATTERNS[id];
    const frames = loopFrames(p);
    for (let t = 0; t < frames.length; t += 0.2) {
      const pose = poseAt(frames, t, p.hold ?? 0.12);
      const sk = solvePose(pose, p.view, p.feet ?? 1);
      const check = (limb: Limb, a: Vec, b: Vec, l: number, seg: 0 | 1) => {
        const scale = limb.len ? limb.len[seg] : 1;
        expect(dist(a, b)).toBeCloseTo(l * scale, 0);
      };
      check(pose.armN, sk.shoulderN, sk.elbowN, LEN.upperArm, 0);
      check(pose.armN, sk.elbowN, sk.handN, LEN.forearm, 1);
      check(pose.legN, sk.hipN, sk.kneeN, LEN.thigh, 0);
      check(pose.legN, sk.kneeN, sk.ankleN, LEN.shin, 1);
    }
  });
});

describe('solver', () => {
  it('reaches a target within range and bends the joint to the requested side', () => {
    const [j1, e1] = solveIk([0, 0], [0, 50], 33, 32, 1);
    const [j2] = solveIk([0, 0], [0, 50], 33, 32, -1);
    expect(dist(e1, [0, 50])).toBeLessThan(0.01);
    expect(dist([0, 0], j1)).toBeCloseTo(33, 5);
    expect(dist(j1, e1)).toBeCloseTo(32, 5);
    expect(Math.sign(j1[0])).toBe(-Math.sign(j2[0]));
  });

  it('clamps unreachable targets to a straight limb', () => {
    const [j, e] = solveIk([0, 0], [0, 500], 33, 32, 1);
    expect(dist([0, 0], e)).toBeCloseTo(65, 1);
    expect(Math.abs(j[0])).toBeLessThan(1);
  });

  it('squat keeps the feet planted while the hips move', () => {
    const p = PATTERNS.squatBack;
    const frames = loopFrames(p);
    const a = solvePose(poseAt(frames, 0, 0), 'side', 1);
    const b = solvePose(poseAt(frames, 1, 0), 'side', 1);
    expect(dist(a.ankleN, b.ankleN)).toBeLessThan(1.5);
    expect(b.hip[1]).toBeGreaterThan(a.hip[1] + 20);
  });
});
