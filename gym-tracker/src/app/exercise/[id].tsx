import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Pencil, Star, Trash2, Trophy } from 'lucide-react-native';
import { LineChart } from '@/components/Charts';
import { Button, Card, EmptyState, ListItem, Row, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '@/constants/labels';
import { deleteCustomExercise, getExercise, parseSecondary, toggleFavorite } from '@/features/exercises/service';
import { getExerciseHistory } from '@/features/workouts/service';
import { listRecordsForExercise, RECORD_LABELS } from '@/features/personal-records/service';
import { exerciseProgress } from '@/features/analytics/service';
import { getExerciseGuide } from '@/features/exercise-guide/guides';
import { HowToPerform } from '@/features/exercise-guide/HowToPerform';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { confirm, useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '@/utils/time';
import { formatWeight, kgToDisplay, round } from '@/utils/units';

type Metric = 'e1rm' | 'weight' | 'reps' | 'volume';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const run = useAction();
  const settings = useSettings();
  const [range, setRange] = useState<RangeKey>('90d');
  const [metric, setMetric] = useState<Metric>('e1rm');
  const ex = useQuery(() => getExercise(id), [id]).data;
  const history = useQuery(() => getExerciseHistory(id, 10), [id]).data ?? [];
  const records = useQuery(() => listRecordsForExercise(id), [id]).data ?? [];
  const progress = useQuery(() => exerciseProgress(id, rangeStart(range)), [id, range]).data ?? [];

  if (!ex) return <Screen><EmptyState title="Exercise not found" /></Screen>;
  const u = settings.weightUnit;
  const points = progress.map((p) => ({
    label: format(p.date, 'd/M'),
    value:
      metric === 'reps' ? p.bestReps : round(kgToDisplay(metric === 'e1rm' ? p.bestE1rm : metric === 'weight' ? p.maxWeightKg : p.volumeKg, u), 1),
  }));
  const secondary = parseSecondary(ex);
  const guide = ex.isCustom ? null : getExerciseGuide(ex.id);

  const del = async () => {
    if (!(await confirm('Delete exercise?', 'If this exercise appears in past workouts or plans it will be archived (hidden) instead, so your history stays intact.'))) return;
    run(() => {
      deleteCustomExercise(ex.id);
      router.back();
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: ex.name }} />
      <Screen>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title" style={{ flex: 1 }}>
              {ex.name}
            </Text>
            <Button title={ex.isFavorite ? 'Favorite' : 'Favorite'} icon={Star} size="sm" variant={ex.isFavorite ? 'primary' : 'secondary'} onPress={() => run(() => toggleFavorite(ex.id))} accessibilityLabel={ex.isFavorite ? 'Remove from favorites' : 'Add to favorites'} />
          </Row>
          <Text variant="caption" color={colors.textSecondary}>
            {MUSCLE_LABELS[ex.primaryMuscle]}
            {secondary.length ? ` (+ ${secondary.map((m) => MUSCLE_LABELS[m]).join(', ')})` : ''} · {EQUIPMENT_LABELS[ex.equipment]} · {EXERCISE_TYPE_LABELS[ex.exerciseType]}
            {ex.isCustom ? ' · Custom' : ''}
            {ex.isArchived ? ' · Archived' : ''}
          </Text>
          {ex.instructions ? <Text color={colors.textSecondary}>{ex.instructions}</Text> : null}
          {ex.isCustom ? (
            <Row>
              <Button title="Edit" icon={Pencil} size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/exercise/edit', params: { id: ex.id } })} />
              <Button title="Delete" icon={Trash2} size="sm" variant="danger" style={{ flex: 1 }} onPress={del} />
            </Row>
          ) : null}
        </Card>

        {guide ? <HowToPerform guide={guide} exerciseName={ex.name} /> : null}

        <Card>
          <SectionHeader title="Strength progression" />
          <Segmented
            options={[
              { key: 'e1rm', label: 'Est. 1RM' },
              { key: 'weight', label: 'Max wt' },
              { key: 'reps', label: 'Best reps' },
              { key: 'volume', label: 'Volume' },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <LineChart
            points={points}
            emptyTitle="No sessions in this range"
            emptyMessage="Complete working sets of this exercise to see progress."
            accessibilityLabel={`${ex.name} ${metric}`}
          />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
          {metric === 'e1rm' ? (
            <Text variant="caption" color={colors.textSecondary}>
              Estimated 1RM uses the Epley formula: weight × (1 + reps / 30). It is an estimate, not a tested max.
            </Text>
          ) : null}
        </Card>

        <Card style={{ paddingVertical: spacing.sm }}>
          <SectionHeader title="Personal records" />
          {records.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No records yet. Records are detected from completed working sets (warm-ups excluded).
            </Text>
          ) : (
            records.map((r) => (
              <ListItem
                key={r.id}
                left={<Trophy color={colors.warning} size={18} />}
                title={`${RECORD_LABELS[r.recordType]}${r.isEstimate ? ' (estimate)' : ''}`}
                subtitle={`${r.recordType === 'max_reps' ? `${r.value} reps` : formatWeight(r.value, u)}${r.weightKg != null && r.reps != null ? ` · ${formatWeight(r.weightKg, u)} × ${r.reps}` : ''} · ${format(r.achievedAt, 'd MMM yyyy')}`}
                onPress={r.sessionId ? () => router.push({ pathname: '/workout/[id]', params: { id: r.sessionId! } }) : undefined}
              />
            ))
          )}
        </Card>

        <SectionHeader title="Recent history" />
        {history.length === 0 ? (
          <Card>
            <EmptyState title="Not performed yet" />
          </Card>
        ) : (
          history.map((h) => (
            <Card key={h.sessionId} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: h.sessionId } })} style={{ gap: spacing.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{h.sessionName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {format(h.date, 'd MMM yyyy')}
                </Text>
              </Row>
              <Text variant="caption" color={colors.textSecondary}>
                {h.sets.map((s) => `${s.weightKg != null ? round(kgToDisplay(s.weightKg, u), 1) : 'BW'}×${s.reps ?? 0}${s.setType === 'warmup' ? 'w' : ''}`).join('  ·  ')}
              </Text>
            </Card>
          ))
        )}
      </Screen>
    </>
  );
}
