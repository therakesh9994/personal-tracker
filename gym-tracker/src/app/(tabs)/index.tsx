import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Camera, ClipboardList, Droplets, Flame, Play, Plus, Scale, Utensils } from 'lucide-react-native';
import { DayBars } from '@/components/Charts';
import { Button, Card, EmptyState, ListItem, ProgressBar, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { loadDashboard } from '@/features/dashboard/service';
import { useStartWorkout } from '@/features/workouts/useStartWorkout';
import { addWater } from '@/features/nutrition/service';
import { getProfile } from '@/features/settings/service';
import { sessionDurationMs } from '@/features/workouts/calculations';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { useNow } from '@/hooks/useNow';
import { useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { formatDuration, formatDurationShort } from '@/utils/time';
import { formatInt, formatVolume, formatWeight, kgToDisplay, round } from '@/utils/units';

function greeting(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const settings = useSettings();
  const start = useStartWorkout();
  const run = useAction();
  const now = useNow(30_000);
  const { data, error } = useQuery(() => loadDashboard(), [Math.floor(now / 3_600_000)]);
  const profile = useQuery(getProfile).data;
  const tick = useNow(1000, !!data?.openSession);

  if (!data) return <Screen edges={['top', 'bottom']}>{error ? <Text color={colors.error}>{error}</Text> : null}</Screen>;
  const g = data.goals;
  const weightDelta = data.weight && data.weight.previous != null ? data.weight.latest - data.weight.previous : null;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: 2 }}>
        <Text variant="caption" color={colors.textSecondary}>
          {format(now, 'EEEE, d MMMM')}
        </Text>
        <Text variant="display">
          {greeting(new Date(now).getHours())}
          {profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
        </Text>
      </View>

      {data.openSession ? (
        <Card onPress={() => router.push('/workout/active')} style={{ borderColor: colors.accent, borderWidth: 1 }} accessibilityLabel="Resume workout in progress">
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.accent}>
                {data.openSession.status === 'paused' ? 'Paused workout' : 'Workout in progress'}
              </Text>
              <Text variant="heading" numberOfLines={1}>
                {data.openSession.name}
              </Text>
            </View>
            <Text variant="title" color={colors.accent}>
              {formatDuration(sessionDurationMs(data.openSession, tick))}
            </Text>
          </Row>
          <Button title="Resume workout" icon={Play} onPress={() => router.push('/workout/active')} />
        </Card>
      ) : null}

      <Row gap={spacing.sm}>
        <StatTile label="Workouts" value={String(data.totalWorkouts)} sub="all time" />
        <StatTile label="This week" value={String(data.weekWorkouts)} sub="sessions" />
        <StatTile label="Streak" value={`${data.streak}`} sub={data.streak === 1 ? 'day' : 'days'} accent={data.streak > 0} />
      </Row>

      {!data.openSession ? (
        <Card>
          <SectionHeader title="Today's workout" />
          {data.todaysPlan ? (
            <>
              <View style={{ gap: 2 }}>
                <Text variant="title">{data.todaysPlan.day.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {data.todaysPlan.planName} · {data.todaysPlan.exerciseCount} exercises ·{' '}
                  {data.todaysPlan.reason === 'scheduled' ? 'scheduled today' : 'next in rotation'}
                </Text>
              </View>
              <Button title="Start this workout" icon={Play} size="lg" onPress={() => start({ planDayId: data.todaysPlan!.day.id })} />
              <Button title="Start an empty workout instead" variant="ghost" size="sm" onPress={() => start()} />
            </>
          ) : (
            <>
              <Text variant="caption" color={colors.textSecondary}>
                No plan scheduled for today. Start an empty workout or pick a plan.
              </Text>
              <Button title="Start workout" icon={Play} size="lg" onPress={() => start()} />
              <Button title="Browse plans" variant="secondary" onPress={() => router.push('/plans')} />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Weekly activity" action="Progress" onAction={() => router.push('/(tabs)/progress')} />
        <DayBars
          items={data.last7Days.map((b) => ({ label: format(b.key, 'EEEEE'), value: Math.round(kgToDisplay(b.volumeKg, settings.weightUnit)) }))}
          accessibilityLabel={`Training volume in ${settings.weightUnit}, last 7 days`}
        />
        <Text variant="caption" color={colors.textSecondary}>
          {data.last7Days.reduce((n, b) => n + b.workouts, 0)} workouts ·{' '}
          {formatVolume(data.last7Days.reduce((n, b) => n + b.volumeKg, 0), settings.weightUnit)} ·{' '}
          {formatDurationShort(data.last7Days.reduce((n, b) => n + b.durationMs, 0))}
        </Text>
      </Card>

      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/(tabs)/nutrition')} accessibilityLabel="Today's calories">
          <Row>
            <Flame color={colors.warning} size={18} />
            <Text variant="label" color={colors.textSecondary}>
              Calories
            </Text>
          </Row>
          <Text variant="title">{formatInt(data.nutrition.calories)}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {g?.calories ? `of ${formatInt(g.calories)} kcal` : 'No goal set'} · P {Math.round(data.nutrition.protein)}g
          </Text>
          {g?.calories ? <ProgressBar progress={data.nutrition.calories / g.calories} /> : null}
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/body/measurements')} accessibilityLabel="Body weight">
          <Row>
            <Scale color={colors.accent} size={18} />
            <Text variant="label" color={colors.textSecondary}>
              Weight
            </Text>
          </Row>
          <Text variant="title">{data.weight ? formatWeight(data.weight.latest, settings.weightUnit) : '–'}</Text>
          <Text variant="caption" color={weightDelta == null ? colors.textSecondary : weightDelta > 0 ? colors.warning : colors.success}>
            {data.weight
              ? weightDelta == null
                ? format(data.weight.measuredAt, 'd MMM')
                : `${weightDelta > 0 ? '+' : ''}${round(kgToDisplay(weightDelta, settings.weightUnit), 1)} ${settings.weightUnit} since last`
              : 'Not logged yet'}
          </Text>
        </Card>
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Droplets color="#5CC8FF" size={18} />
            <Text variant="label" color={colors.textSecondary}>
              Water
            </Text>
          </Row>
          <Text variant="bodyStrong">
            {data.waterMl} {g?.waterMl ? `/ ${g.waterMl} ml` : 'ml'}
          </Text>
        </Row>
        {g?.waterMl ? <ProgressBar progress={data.waterMl / g.waterMl} color="#5CC8FF" /> : null}
        <Row>
          {[250, 500].map((ml) => (
            <Button key={ml} title={`+${ml} ml`} size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => run(() => addWater(ml))} />
          ))}
        </Row>
      </Card>

      <SectionHeader title="Quick actions" />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <QuickAction icon={Utensils} label="Log food" onPress={() => router.push({ pathname: '/nutrition/foods', params: { meal: 'snack', day: String(Date.now()) } })} />
        <QuickAction icon={Scale} label="Log weight" onPress={() => router.push('/body/edit')} />
        <QuickAction icon={Camera} label="Add photo" onPress={() => router.push('/photos')} />
        <QuickAction icon={ClipboardList} label="Plans" onPress={() => router.push('/plans')} />
      </Row>

      <SectionHeader title="Recent workouts" action={data.recent.length ? 'See all' : undefined} onAction={() => router.push('/workout/history')} />
      {data.recent.length === 0 ? (
        <Card>
          <EmptyState icon={Plus} title="No workouts yet" message="Completed workouts appear here." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.xs }}>
          {data.recent.map((w) => (
            <ListItem
              key={w.id}
              title={w.name}
              subtitle={`${format(w.startedAt, 'EEE d MMM')} · ${w.exerciseCount} exercises · ${formatVolume(w.volumeKg, settings.weightUnit)}`}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function QuickAction({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }} accessibilityLabel={label}>
      <Icon color={colors.accent} size={20} />
      <Text variant="bodyStrong">{label}</Text>
    </Card>
  );
}
