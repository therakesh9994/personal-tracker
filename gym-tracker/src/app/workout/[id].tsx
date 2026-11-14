import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Pencil, Plus, RotateCcw, Trash2, Trophy } from 'lucide-react-native';
import { DistributionBars } from '@/components/Charts';
import { Button, Card, EmptyState, Field, ListItem, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { ExerciseCard } from '@/features/workouts/components/ExerciseCard';
import * as W from '@/features/workouts/service';
import { sessionDurationMs, summarizeSession } from '@/features/workouts/calculations';
import { listRecordsForSession, RECORD_LABELS } from '@/features/personal-records/service';
import { useStartWorkout } from '@/features/workouts/useStartWorkout';
import { MUSCLE_LABELS } from '@/constants/labels';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { confirm, useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { formatDurationShort } from '@/utils/time';
import { formatVolume, formatWeight, round } from '@/utils/units';

export default function WorkoutDetailScreen() {
  const { id, justFinished } = useLocalSearchParams<{ id: string; justFinished?: string }>();
  const router = useRouter();
  const settings = useSettings();
  const run = useAction();
  const start = useStartWorkout();
  const [editing, setEditing] = useState(false);
  const detail = useQuery(() => W.getSessionDetail(id), [id]).data;
  const records = useQuery(() => listRecordsForSession(id), [id]).data ?? [];
  const summary = useMemo(() => (detail ? summarizeSession(detail.exercises) : null), [detail]);

  if (!detail || !summary) {
    return (
      <Screen>
        <EmptyState title="Workout not found" message="It may have been deleted." action="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }
  const s = detail.session;
  const remove = async () => {
    if (!(await confirm('Delete workout?', 'This workout will be removed from your history and personal records will be recalculated.'))) return;
    run(() => {
      W.deleteSession(s.id);
      router.back();
    });
  };

  return (
    <Screen>
      {justFinished != null ? (
        <Card style={{ borderColor: colors.accent, borderWidth: 1, alignItems: 'center' }}>
          <Trophy color={colors.accent} size={32} />
          <Text variant="title">Workout complete</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {Number(justFinished) > 0 ? `${justFinished} personal record${justFinished === '1' ? '' : 's'} set or matched in this session.` : 'Saved to your history.'}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: 2 }}>
        {editing ? (
          <EditableText key={`name:${s.id}`} initial={s.name} onSave={(v) => run(() => W.renameSession(s.id, v))} accessibilityLabel="Workout name" />
        ) : (
          <Text variant="title">{s.name}</Text>
        )}
        <Text variant="caption" color={colors.textSecondary}>
          {format(s.startedAt, 'EEEE d MMMM yyyy, HH:mm')}
          {s.status !== 'completed' ? ` · ${s.status}` : ''}
        </Text>
      </View>

      <Row gap={spacing.sm}>
        <StatTile label="Duration" value={formatDurationShort(sessionDurationMs(s))} />
        <StatTile label="Volume" value={formatVolume(summary.totalVolumeKg, settings.weightUnit)} />
      </Row>
      <Row gap={spacing.sm}>
        <StatTile label="Sets" value={String(summary.completedSets)} />
        <StatTile label="Reps" value={String(summary.totalReps)} />
        <StatTile label="Exercises" value={String(summary.exerciseCount)} />
      </Row>

      {records.length > 0 ? (
        <Card style={{ paddingVertical: spacing.sm }}>
          <SectionHeader title="Personal records" />
          {records.map((r) => (
            <ListItem
              key={r.id}
              left={<Trophy color={colors.warning} size={18} />}
              title={`${r.exerciseName}`}
              subtitle={`${RECORD_LABELS[r.recordType]}: ${
                r.recordType === 'max_reps' ? `${r.value} reps` : formatWeight(r.value, settings.weightUnit)
              }${r.isEstimate ? ' (estimate)' : ''}${r.weightKg != null && r.reps != null ? ` · ${formatWeight(r.weightKg, settings.weightUnit)} × ${r.reps}` : ''}`}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Muscle groups (working sets)" />
        <DistributionBars
          items={Object.entries(summary.muscleDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([m, n]) => ({ label: MUSCLE_LABELS[m as keyof typeof MUSCLE_LABELS], value: n }))}
          formatValue={(v) => `${v} sets`}
        />
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <SectionHeader title="Exercises" />
        <Button title={editing ? 'Done' : 'Edit'} icon={Pencil} size="sm" variant={editing ? 'primary' : 'secondary'} onPress={() => setEditing((v) => !v)} />
      </Row>
      {editing ? (
        <Text variant="caption" color={colors.textSecondary}>
          Editing a past workout recalculates personal records for the affected exercises.
        </Text>
      ) : null}
      {detail.exercises.map((ex, i) =>
        editing ? (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            sessionId={s.id}
            previous={null}
            unit={settings.weightUnit}
            index={i}
            count={detail.exercises.length}
            defaultRest={settings.defaultRestSeconds}
          />
        ) : (
          <Card key={ex.id} style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong" color={colors.accent} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.exerciseId } })}>
              {ex.exerciseName}
            </Text>
            {ex.sets.map((st) => (
              <Row key={st.id} style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color={st.setType === 'warmup' ? colors.warning : colors.textSecondary}>
                  {st.setType === 'working' ? `Set ${st.setNumber}` : `Set ${st.setNumber} · ${st.setType}`}
                </Text>
                <Text variant="mono">
                  {st.weightKg != null ? formatWeight(st.weightKg, settings.weightUnit) : 'BW'} × {st.reps ?? 0}
                  {st.rpe != null ? `  @${round(st.rpe, 1)}` : ''}
                </Text>
              </Row>
            ))}
            {ex.note ? (
              <Text variant="caption" color={colors.textSecondary} style={{ fontStyle: 'italic' }}>
                {ex.note.content}
              </Text>
            ) : null}
          </Card>
        ),
      )}
      {editing ? (
        <Button title="Add exercise" icon={Plus} variant="secondary" onPress={() => router.push({ pathname: '/exercise', params: { pick: 'session', targetId: s.id } })} />
      ) : null}

      <Card>
        {editing ? (
          <EditableText key={`notes:${s.id}`} label="Notes" initial={detail.sessionNote?.content ?? ''} onSave={(v) => run(() => W.saveNote(s.id, v))} multiline />
        ) : (
          <>
            <SectionHeader title="Notes" />
            <Text color={detail.sessionNote ? colors.text : colors.textSecondary}>{detail.sessionNote?.content ?? 'No notes.'}</Text>
          </>
        )}
      </Card>

      <Button title="Repeat this workout" icon={RotateCcw} onPress={() => start({ sourceSessionId: s.id })} />
      <Button title="Delete workout" icon={Trash2} variant="danger" onPress={remove} />
    </Screen>
  );
}

function EditableText({ initial, onSave, label, multiline, accessibilityLabel }: { initial: string; onSave: (v: string) => void; label?: string; multiline?: boolean; accessibilityLabel?: string }) {
  const [v, setV] = useState(initial);
  return <Field label={label} value={v} onChangeText={setV} onBlur={() => v !== initial && onSave(v)} multiline={multiline} accessibilityLabel={accessibilityLabel ?? label} />;
}
