import { memo, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { createAnimatedComponent, useAnimatedProps, useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, radius } from '@/theme';
import { ANATOMY } from './palette';
import { drawConfig, drawFrame, type DrawItem, type MuscleTargets, type Role } from './drawing';
import { loopFrames, PATTERNS, type PatternId } from './patterns';
import { poseAt, solvePose, VIEW } from './skeleton';

const AnimatedLine = createAnimatedComponent(Line);
const AnimatedCircle = createAnimatedComponent(Circle);
const AnimatedPath = createAnimatedComponent(Path);

const ROLE_STYLE: Record<Role, { color: string; opacity: number }> = {
  scene: { color: colors.textSecondary, opacity: 0.3 },
  equip: { color: colors.textSecondary, opacity: 1 },
  equipFill: { color: colors.textSecondary, opacity: 1 },
  cable: { color: colors.textSecondary, opacity: 0.8 },
  skin: { color: ANATOMY.skin, opacity: 1 },
  skinFar: { color: ANATOMY.skinFar, opacity: 1 },
  muscle: { color: ANATOMY.muscle, opacity: 1 },
  primary: { color: ANATOMY.primary, opacity: 1 },
  secondary: { color: ANATOMY.secondary, opacity: 1 },
  primaryFar: { color: ANATOMY.primaryFar, opacity: 1 },
  secondaryFar: { color: ANATOMY.secondaryFar, opacity: 1 },
};

type Geo = SharedValue<DrawItem[]>;

const LineItem = memo(function LineItem({ i, geo, item }: { i: number; geo: Geo; item: DrawItem }) {
  const props = useAnimatedProps(() => {
    const v = geo.value[i]?.v ?? item.v;
    return { x1: v[0], y1: v[1], x2: v[2], y2: v[3] };
  });
  const s = ROLE_STYLE[item.role];
  return <AnimatedLine animatedProps={props} x1={item.v[0]} y1={item.v[1]} x2={item.v[2]} y2={item.v[3]} stroke={s.color} strokeOpacity={s.opacity} strokeWidth={item.w} strokeLinecap="round" />;
});

const CircleItem = memo(function CircleItem({ i, geo, item }: { i: number; geo: Geo; item: DrawItem }) {
  const props = useAnimatedProps(() => {
    const v = geo.value[i]?.v ?? item.v;
    return { cx: v[0], cy: v[1], r: v[2] };
  });
  const s = ROLE_STYLE[item.role];
  const filled = item.w === 0;
  return (
    <AnimatedCircle
      animatedProps={props}
      cx={item.v[0]}
      cy={item.v[1]}
      r={item.v[2]}
      fill={filled ? s.color : 'none'}
      fillOpacity={s.opacity}
      stroke={filled ? 'none' : s.color}
      strokeOpacity={s.opacity}
      strokeWidth={item.w}
    />
  );
});

const PathItem = memo(function PathItem({ i, geo, item }: { i: number; geo: Geo; item: DrawItem }) {
  const props = useAnimatedProps(() => ({ d: geo.value[i]?.d ?? item.d ?? '' }));
  const s = ROLE_STYLE[item.role];
  if (item.k === 'f') {
    return <AnimatedPath animatedProps={props} d={item.d} fill={s.color} fillOpacity={s.opacity} stroke={ANATOMY.outline} strokeWidth={item.w} strokeLinejoin="round" />;
  }
  return <AnimatedPath animatedProps={props} d={item.d} stroke={s.color} strokeOpacity={s.opacity} strokeWidth={item.w} fill="none" />;
});

/** Static scenery never moves, so it is drawn without animation hooks. */
function StaticItem({ item }: { item: DrawItem }) {
  const s = ROLE_STYLE[item.role];
  if (item.k === 'l') {
    return <Line x1={item.v[0]} y1={item.v[1]} x2={item.v[2]} y2={item.v[3]} stroke={s.color} strokeOpacity={s.opacity} strokeWidth={item.w} strokeLinecap="round" />;
  }
  return <Circle cx={item.v[0]} cy={item.v[1]} r={item.v[2]} fill="none" stroke={s.color} strokeOpacity={s.opacity} strokeWidth={item.w} />;
}

/**
 * Looping animated anatomical figure demonstrating a movement pattern, with the worked
 * muscles highlighted. Fully vector, works offline.
 * `speed` scales the tempo (0.5 = slow motion). Animation only runs while `playing` and
 * the screen is focused. Mount with `key={pattern}` so a new pattern starts fresh.
 */
export function ExerciseAnimation({
  pattern,
  muscles,
  playing,
  speed = 1,
  accessibilityLabel,
}: {
  pattern: PatternId;
  muscles: MuscleTargets;
  playing: boolean;
  speed?: number;
  accessibilityLabel: string;
}) {
  const p = PATTERNS[pattern];
  const frames = useMemo(() => loopFrames(p), [p]);
  const cfg = useMemo(() => drawConfig(p, muscles), [p, muscles]);
  const view = p.view;
  const feet = p.feet ?? 1;
  const hold = p.hold ?? 0.12;
  const n = frames.length;
  const msPerFrame = p.tempo / speed;

  const items = useMemo(() => drawFrame(solvePose(poseAt(frames, 0, hold), view, feet), cfg), [frames, cfg, hold, view, feet]);
  const t = useSharedValue(0);
  const ms = useSharedValue(msPerFrame);
  const focused = useIsFocused();

  useEffect(() => {
    ms.set(msPerFrame);
  }, [ms, msPerFrame]);

  const frameCb = useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame ?? 0;
    t.value = (t.value + dt / ms.value) % n;
  }, false);

  useEffect(() => {
    frameCb.setActive(playing && focused);
    return () => frameCb.setActive(false);
  }, [frameCb, playing, focused]);

  const geo = useDerivedValue(() => drawFrame(solvePose(poseAt(frames, t.value, hold), view, feet), cfg));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: '100%', aspectRatio: VIEW.w / VIEW.h, maxHeight: 280, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }}
    >
      <Svg key={pattern} width="100%" height="100%" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}>
        {items.map((item, i) => {
          if (item.role === 'scene') return <StaticItem key={i} item={item} />;
          if (item.k === 'l') return <LineItem key={i} i={i} geo={geo} item={item} />;
          if (item.k === 'c') return <CircleItem key={i} i={i} geo={geo} item={item} />;
          return <PathItem key={i} i={i} geo={geo} item={item} />;
        })}
      </Svg>
    </View>
  );
}
