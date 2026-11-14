import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { addMonths, addWeeks, format, startOfMonth } from 'date-fns';
import { CalendarRange, Camera, ChevronRight, Ruler, Trophy } from 'lucide-react-native';
import { BarChart, DistributionBars, LineChart } from '@/components/Charts';
import { Button, Card, ChipRow, Row, Screen, SectionHeader, Segmented, StatTile, Text } from '@/components/ui';
import { MUSCLE_LABELS } from '@/constants/labels';
import {
  exerciseProgress,
  fillBuckets,
  monthlyBuckets,
  muscleDistribution,
  nutritionDaily,
  sessionStats,
  trainedExercises,
  weeklyBuckets,
  weeklyCalorieAverages,
} from '@/features/analytics/service';
import { measurementSeries } from '@/features/measurements/service';
import { recordSummary } from '@/features/personal-records/service';
import { useQuery } from '@/hooks/useQuery';
import { useNow } from '@/hooks/useNow';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatDurationShort, RANGE_OPTIONS, rangeStart, weekStart, type RangeKey } from '@/utils/time';
import { cmToDisplay, formatVolume, kgToDisplay, round } from '@/utils/units';

type TrainingMetric = 'workouts' | 'volume' | 'time';
type BodyMetric = 'weightKg' | 'bodyFatPct' | 'chestCm' | 'waistCm' | 'arms';
type NutritionMetric = 'calories' | 'protein' | 'carbs' | 'fat' | 'weekly';

export default function ProgressTab() {
  const router = useRouter();
  const s = useSettings();
  const [range, setRange] = useState<RangeKey>('90d');
  const [trainingMetric, setTrainingMetric] = useState<TrainingMetric>('workouts');
  const [bucket, setBucket] = useState<'week' | 'month'>('week');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [strengthMetric, setStrengthMetric] = useState<'e1rm' | 'weight' | 'volume'>('e1rm');
  const [bodyMetric, setBodyMetric] = useState<BodyMetric>('weightKg');
  const [nutritionMetric, setNutritionMetric] = useState<NutritionMetric>('calories');
  // Tabs stay mounted: skip all queries while this tab is hidden, so logging sets
  // elsewhere doesn't recompute analytics in the background.
  const focused = useIsFocused();
  const live = { enabled: focused };
  // Refreshes at least every minute while visible (and on app resume), so the
  // range start and "this month" stay current across midnight / month changes.
  const clock = useNow(60_000, focused);
  const monthKey = startOfMonth(clock).getTime();
  const since = rangeStart(range, clock);
  const u = s.weightUnit;

  const statsData = useQuery(() => sessionStats(since), [since], live).data;
  const stats = useMemo(() => statsData ?? [], [statsData]);
  const muscles = useQuery(() => muscleDistribution(since), [since], live).data ?? [];
  const exercises = useQuery(trainedExercises, [], live).data ?? [];
  const selectedExercise = exerciseId ?? exercises[0]?.id ?? null;
  const strength = useQuery(() => (selectedExercise ? exerciseProgress(selectedExercise, since) : []), [selectedExercise, since], live).data ?? [];
  const body = useQuery(() => {
    if (bodyMetric === 'arms') {
      const l = measurementSeries('leftArmCm', since);
      const r = measurementSeries('rightArmCm', since);
      const map = new Map<number, number[]>();
      for (const p of [...l, ...r]) map.set(p.x, [...(map.get(p.x) ?? []), p.y]);
      return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b, 0) / ys.length }));
    }
    return measurementSeries(bodyMetric, since);
  }, [bodyMetric, since], live).data ?? [];
  const nutrition = useQuery(() => nutritionDaily(since), [since], live).data ?? [];

  const buckets = useMemo(() => {
    if (stats.length === 0) return [];
    const raw = bucket === 'week' ? weeklyBuckets(stats) : monthlyBuckets(stats);
    const start = range === 'all' ? raw[0].key : bucket === 'week' ? weekStart(since) : startOfMonth(since).getTime();
    const end = bucket === 'week' ? weekStart(clock) : startOfMonth(clock).getTime();
    return fillBuckets(raw, start, end, (k) => (bucket === 'week' ? addWeeks(k, 1).getTime() : addMonths(k, 1).getTime()));
  }, [stats, bucket, since, range, clock]);

  const totals = {
    workouts: stats.length,
    volume: stats.reduce((a, b) => a + b.volumeKg, 0),
    time: stats.reduce((a, b) => a + b.durationMs, 0),
  };

  const bodyDisplay = (v: number) => (bodyMetric === 'weightKg' ? kgToDisplay(v, u) : bodyMetric === 'bodyFatPct' ? v : cmToDisplay(v, s.lengthUnit));
  const bodyUnit = bodyMetric === 'weightKg' ? u : bodyMetric === 'bodyFatPct' ? '%' : s.lengthUnit;
  const bodyChange = body.length >= 2 ? bodyDisplay(body[body.length - 1].y) - bodyDisplay(body[0].y) : null;

  /** Selected strength metric for one session, in kg (single source for headline and chart). */
  const strengthKg = (p: (typeof strength)[number]) => (strengthMetric === 'e1rm' ? p.bestE1rm : strengthMetric === 'weight' ? p.maxWeightKg : p.volumeKg);
  const formatStrength = (kg: number) => (strengthMetric === 'volume' ? formatVolume(kg, u) : `${round(kgToDisplay(kg, u), 1)} ${u}`);
  const strengthHeadline =
    strength.length > 0
      ? (() => {
          const lastKg = strengthKg(strength[strength.length - 1]);
          const diffKg = strength.length > 1 ? lastKg - strengthKg(strength[0]) : 0;
          // Ignore changes that round to zero in the display unit.
          const visible = strengthMetric === 'volume' ? Math.abs(kgToDisplay(diffKg, u)) >= 0.5 : Math.abs(kgToDisplay(diffKg, u)) >= 0.05;
          return {
            value: formatStrength(lastKg),
            change: visible ? `${diffKg > 0 ? '+' : '−'}${formatStrength(Math.abs(diffKg))}` : null,
            up: diffKg > 0,
          };
        })()
      : null;
  const prSummary = useQuery(() => recordSummary(monthKey), [monthKey], live).data ?? { thisMonth: 0, total: 0 };

  const nutritionPoints =
    nutritionMetric === 'weekly'
      ? weeklyCalorieAverages(nutrition).map((w) => ({ label: format(w.week, 'd/M'), value: Math.round(w.avgCalories) }))
      : nutrition.map((d) => {
          const [y, m, dd] = d.day.split('-').map(Number);
          return { label: format(new Date(y, m - 1, dd), 'd/M'), value: Math.round(d[nutritionMetric]) };
        });

  return (
    <Screen edges={['top']}>
      <Text variant="display">Progress</Text>
      <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />

      <Row gap={spacing.sm}>
        <StatTile label="Workouts" value={String(totals.workouts)} />
        <StatTile label="Volume" value={formatVolume(totals.volume, u)} />
        <StatTile label="Time" value={formatDurationShort(totals.time)} />
      </Row>

      <Card>
        <SectionHeader title="Strength" action={selectedExercise ? 'Details' : undefined} onAction={() => selectedExercise && router.push({ pathname: '/exercise/[id]', params: { id: selectedExercise } })} />
        {exercises.length > 0 ? <ChipRow options={exercises.slice(0, 20).map((e) => ({ key: e.id, label: e.name }))} value={selectedExercise} onChange={(v) => v && setExerciseId(v)} /> : null}
        {strengthHeadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text variant="display" style={{ fontSize: 28 }}>
              {strengthHeadline.value}
            </Text>
            {strengthHeadline.change ? (
              <Text variant="bodyStrong" color={strengthHeadline.up ? colors.success : colors.warning}>
                {strengthHeadline.change}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Segmented
          options={[
            { key: 'e1rm', label: 'Est. 1RM' },
            { key: 'weight', label: 'Max weight' },
            { key: 'volume', label: 'Volume' },
          ]}
          value={strengthMetric}
          onChange={setStrengthMetric}
        />
        <LineChart
          points={strength.map((p) => ({
            label: format(p.date, 'd/M'),
            value: round(kgToDisplay(strengthKg(p), u), 1),
          }))}
          emptyTitle="No strength data"
          emptyMessage="Complete working sets to track strength progression."
          accessibilityLabel="Strength progression"
        />
        {strengthMetric === 'e1rm' ? (
          <Text variant="caption" color={colors.textSecondary}>
            Estimated with the Epley formula. Estimates are not tested maxes.
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Muscle groups · working sets" />
        <DistributionBars items={muscles.map((m) => ({ label: MUSCLE_LABELS[m.muscle], value: m.sets }))} formatValue={(v) => `${v} sets`} />
      </Card>

      <Card onPress={() => router.push('/records')} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Personal records">
        <Trophy color={colors.warning} size={22} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Personal records</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {prSummary.thisMonth} new this month · {prSummary.total} tracked
          </Text>
        </View>
        <ChevronRight color={colors.textSecondary} size={18} />
      </Card>

      <Card>
        <SectionHeader title="Training" />
        <Segmented
          options={[
            { key: 'workouts', label: 'Frequency' },
            { key: 'volume', label: 'Volume' },
            { key: 'time', label: 'Time' },
          ]}
          value={trainingMetric}
          onChange={setTrainingMetric}
        />
        <BarChart
          points={buckets.map((b) => ({
            label: bucket === 'week' ? format(b.key, 'd/M') : format(b.key, 'MMM'),
            value: trainingMetric === 'workouts' ? b.workouts : trainingMetric === 'volume' ? Math.round(kgToDisplay(b.volumeKg, u)) : Math.round(b.durationMs / 60000),
          }))}
          emptyTitle="No workouts in this range"
          emptyMessage="Completed workouts will appear here."
          accessibilityLabel={`${trainingMetric} per ${bucket}`}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="caption" color={colors.textSecondary}>
            {trainingMetric === 'workouts' ? 'Workouts' : trainingMetric === 'volume' ? `Volume (${u})` : 'Minutes'} per {bucket}
          </Text>
          <View style={{ width: 160 }}>
            <Segmented
              options={[
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
              ]}
              value={bucket}
              onChange={setBucket}
            />
          </View>
        </Row>
      </Card>

      <Card>
        <SectionHeader title="Body" action="All" onAction={() => router.push('/body/measurements')} />
        <Segmented
          options={[
            { key: 'weightKg', label: 'Weight' },
            { key: 'bodyFatPct', label: 'Fat %' },
            { key: 'chestCm', label: 'Chest' },
            { key: 'waistCm', label: 'Waist' },
            { key: 'arms', label: 'Arms' },
          ]}
          value={bodyMetric}
          onChange={setBodyMetric}
        />
        <LineChart
          points={body.map((p) => ({ label: format(p.x, 'd/M'), value: round(bodyDisplay(p.y), 1) }))}
          emptyTitle="No body data"
          emptyMessage="Add body measurements to see trends."
          accessibilityLabel="Body measurement trend"
        />
        {bodyChange != null ? (
          <Text variant="caption" color={colors.textSecondary}>
            Change in range: {bodyChange > 0 ? '+' : ''}
            {round(bodyChange, 1)} {bodyUnit}
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Nutrition" />
        <Segmented
          options={[
            { key: 'calories', label: 'kcal' },
            { key: 'protein', label: 'Protein' },
            { key: 'carbs', label: 'Carbs' },
            { key: 'fat', label: 'Fat' },
            { key: 'weekly', label: 'Wk avg' },
          ]}
          value={nutritionMetric}
          onChange={setNutritionMetric}
        />
        {nutritionMetric === 'calories' || nutritionMetric === 'weekly' ? (
          <BarChart points={nutritionPoints} color={colors.warning} emptyTitle="No nutrition logged" emptyMessage="Log meals to see intake trends." accessibilityLabel="Calorie intake" />
        ) : (
          <LineChart points={nutritionPoints} color={colors.series[1]} emptyTitle="No nutrition logged" emptyMessage="Log meals to see macro trends." accessibilityLabel={`${nutritionMetric} intake`} />
        )}
        <Text variant="caption" color={colors.textSecondary}>
          {nutritionMetric === 'weekly' ? 'Average calories per logged day, by week.' : nutritionMetric === 'calories' ? 'Daily calories (kcal).' : `Daily ${nutritionMetric} (g).`}
        </Text>
      </Card>
      <Row gap={spacing.sm}>
        <Button title="Monthly report" icon={CalendarRange} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/reports/monthly')} />
        <Button title="Photos" icon={Camera} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/photos')} />
      </Row>
      <Button title="Body measurements" icon={Ruler} variant="secondary" size="sm" onPress={() => router.push('/body/measurements')} />
    </Screen>
  );
}
