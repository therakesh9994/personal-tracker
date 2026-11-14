import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { BookOpen, ClipboardList, History, Play, PlusCircle, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { Button, Card, Chip, EmptyState, ListItem, Row, Screen, SectionHeader, Text } from '@/components/ui';
import * as W from '@/features/workouts/service';
import { listPlans, getPlanDetail } from '@/features/plans/service';
import { useStartWorkout } from '@/features/workouts/useStartWorkout';
import { sessionDurationMs } from '@/features/workouts/calculations';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { useNow } from '@/hooks/useNow';
import { colors, spacing } from '@/theme';
import { formatDuration, formatDurationShort } from '@/utils/time';
import { formatVolume } from '@/utils/units';

export default function WorkoutTab() {
  const router = useRouter();
  const settings = useSettings();
  const start = useStartWorkout();
  const open = useQuery(() => W.getOpenSession()).data;
  const now = useNow(1000, !!open);
  const recent = useQuery(() => W.listHistory({ limit: 5 })).data ?? [];
  const plans = useQuery(() => listPlans().slice(0, 6).map((p) => getPlanDetail(p.id)!).filter(Boolean)).data ?? [];

  return (
    <Screen edges={['top']}>
      <Text variant="display">Workout</Text>

      {open ? (
        <Card style={{ borderColor: colors.accent, borderWidth: 1 }}>
          <Text variant="label" color={colors.accent}>
            {open.status === 'paused' ? 'Paused' : 'In progress'} · {formatDuration(sessionDurationMs(open, now))}
          </Text>
          <Text variant="title">{open.name}</Text>
          <Button title="Resume workout" icon={Play} size="lg" onPress={() => router.push('/workout/active')} />
        </Card>
      ) : (
        <Card>
          <Text variant="heading">Ready to train?</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Start an empty session and add exercises as you go, or start from a plan below.
          </Text>
          <Button title="Start empty workout" icon={Play} size="lg" onPress={() => start()} />
        </Card>
      )}

      <Row gap={spacing.sm}>
        <QuickTile icon={History} label="History" a11y="Workout history" onPress={() => router.push('/workout/history')} />
        <QuickTile icon={ClipboardList} label="Plans" a11y="Workout plans" onPress={() => router.push('/plans')} />
        <QuickTile icon={BookOpen} label="Exercises" a11y="Exercise library" onPress={() => router.push('/exercise')} />
        <QuickTile icon={PlusCircle} label="Custom" a11y="Create custom exercise" onPress={() => router.push('/exercise/edit')} />
      </Row>

      <SectionHeader title="Start from a plan" action="All plans" onAction={() => router.push('/plans')} />
      {plans.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No plans yet" action="Create a plan" onAction={() => router.push('/plans')} />
        </Card>
      ) : (
        plans.map((p) => (
          <Card key={p.plan.id} style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {p.plan.name}
              </Text>
              <Button title="Edit" size="sm" variant="ghost" onPress={() => router.push({ pathname: '/plans/[id]', params: { id: p.plan.id } })} />
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {p.days.map((d) => (
                <Chip key={d.id} label={`${d.name} · ${d.exercises.length}`} onPress={() => !open && start({ planDayId: d.id })} />
              ))}
            </View>
          </Card>
        ))
      )}

      <SectionHeader title="Repeat a previous workout" action="History" onAction={() => router.push('/workout/history')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {recent.length === 0 ? (
          <EmptyState icon={History} title="No completed workouts yet" />
        ) : (
          recent.map((w) => (
            <ListItem
              key={w.id}
              title={w.name}
              subtitle={`${format(w.startedAt, 'EEE d MMM')} · ${formatDurationShort(sessionDurationMs({ ...w, pausedAt: null }))} · ${formatVolume(w.volumeKg, settings.weightUnit)}`}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
              right={<Button title="Repeat" icon={RotateCcw} size="sm" variant="secondary" disabled={!!open} onPress={() => start({ sourceSessionId: w.id })} />}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

/**
 * Compact shortcut tile. Four share a row, so the default card padding (16 px each side)
 * would leave too little room for labels like "Exercises" on narrow phones.
 */
function QuickTile({ icon: Icon, label, a11y, onPress }: { icon: LucideIcon; label: string; a11y: string; onPress: () => void }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.md, gap: spacing.xs }} onPress={onPress} accessibilityLabel={a11y}>
      <Icon color={colors.accent} size={22} />
      <Text variant="caption" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
    </Card>
  );
}
