import { memo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Check, Copy, Info, MoreHorizontal, NotebookPen, Plus, Timer, Trash2 } from 'lucide-react-native';
import { OptionSheet } from '@/components/OptionSheet';
import { Button, Card, Field, IconButton, NumberInput, Row, Text, flushPendingInputs } from '@/components/ui';
import { MUSCLE_LABELS, SET_TYPE_LABELS, SET_TYPE_SHORT } from '@/constants/labels';
import { SET_TYPES, type SetType, type WorkoutSet } from '@/database/schema';
import { useAction, confirm } from '@/hooks/useAction';
import { colors, radius, spacing } from '@/theme';
import { displayToKg, kgToDisplay, round, type WeightUnit } from '@/utils/units';
import { formatDuration } from '@/utils/time';
import type { WorkoutExerciseWithSets, PreviousPerformance } from '../repository';
import * as W from '../service';

interface Props {
  exercise: WorkoutExerciseWithSets;
  sessionId: string;
  previous: PreviousPerformance | null;
  unit: WeightUnit;
  index: number;
  count: number;
  defaultRest: number;
  editable?: boolean;
  onSetCompleted?: (restSeconds: number) => void;
}

function formatSet(s: Pick<WorkoutSet, 'weightKg' | 'reps'>, unit: WeightUnit) {
  if (s.reps == null) return '–';
  return s.weightKg != null && s.weightKg > 0 ? `${round(kgToDisplay(s.weightKg, unit), 1)}×${s.reps}` : `${s.reps} reps`;
}

export const ExerciseCard = memo(function ExerciseCard({ exercise, sessionId, previous, unit, index, count, defaultRest, editable = true, onSetCompleted }: Props) {
  const router = useRouter();
  const run = useAction();
  const [menu, setMenu] = useState(false);
  const [typeFor, setTypeFor] = useState<WorkoutSet | null>(null);
  const [restSheet, setRestSheet] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!exercise.note);
  const [note, setNote] = useState(exercise.note?.content ?? '');
  const rest = exercise.restSeconds ?? defaultRest;

  const toggle = (s: WorkoutSet) =>
    run(() => {
      const nowDone = !s.isCompleted;
      W.setCompleted(s.id, nowDone);
      if (nowDone) onSetCompleted?.(rest);
    }, 'Could not update set');

  const removeExercise = async () => {
    if (exercise.sets.some((s) => s.isCompleted) && !(await confirm('Remove exercise?', `${exercise.exerciseName} and its sets will be removed from this workout.`, 'Remove'))) return;
    run(() => W.removeExercise(exercise.id));
  };

  const doneCount = exercise.sets.filter((s) => s.isCompleted).length;

  return (
    <Card style={{ padding: spacing.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.exerciseId } })} accessibilityRole="button" accessibilityHint="Open exercise details">
          <Text variant="title" color={colors.accent} numberOfLines={2} style={{ fontSize: 18 }}>
            {exercise.exerciseName}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {MUSCLE_LABELS[exercise.primaryMuscle]} · {doneCount}/{exercise.sets.length} sets · rest {formatDuration(rest * 1000)}
          </Text>
        </Pressable>
        {editable ? <IconButton icon={MoreHorizontal} label={`Options for ${exercise.exerciseName}`} onPress={() => setMenu(true)} size={36} /> : null}
      </Row>

      {previous && previous.sets.length > 0 ? (
        <Text variant="caption" color={colors.textSecondary}>
          Last time: {previous.sets.map((s) => formatSet(s, unit)).join(', ')}
        </Text>
      ) : null}

      <Row style={{ paddingHorizontal: 2 }}>
        <Text variant="label" color={colors.textSecondary} style={{ width: 36, textAlign: 'center' }}>
          Set
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ flex: 1 }}>
          Prev
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ width: 66, textAlign: 'center' }}>
          {unit}
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ width: 52, textAlign: 'center' }}>
          Reps
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ width: 44, textAlign: 'center' }}>
          RPE
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ width: 44, textAlign: 'center' }}>
          Done
        </Text>
      </Row>

      {exercise.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          unit={unit}
          previous={previous?.sets[i] ?? null}
          editable={editable}
          onToggle={() => toggle(s)}
          onTypePress={() => setTypeFor(s)}
          onDelete={async () => {
            if (await confirm('Delete set?', `Set ${s.setNumber} will be deleted.`)) run(() => W.deleteSet(s.id));
          }}
        />
      ))}

      {editable ? (
        <Row>
          <Button title="Add set" icon={Plus} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => run(() => W.addSet(exercise.id))} />
          <Button
            title="Empty set"
            icon={Copy}
            variant="ghost"
            size="sm"
            onPress={() => run(() => W.addSet(exercise.id, { duplicatePrevious: false }))}
            accessibilityLabel="Add empty set"
          />
        </Row>
      ) : null}

      {noteOpen ? (
        <Field
          placeholder="Notes for this exercise"
          value={note}
          onChangeText={setNote}
          onBlur={() => run(() => W.saveNote(sessionId, note, exercise.id))}
          multiline
          accessibilityLabel={`Notes for ${exercise.exerciseName}`}
        />
      ) : null}

      <OptionSheet
        visible={menu}
        title={exercise.exerciseName}
        onClose={() => setMenu(false)}
        options={[
          { key: 'up', label: 'Move up', icon: ArrowUp, disabled: index === 0 },
          { key: 'down', label: 'Move down', icon: ArrowDown, disabled: index === count - 1 },
          { key: 'rest', label: `Rest time (${formatDuration(rest * 1000)})`, icon: Timer },
          { key: 'note', label: noteOpen ? 'Hide note' : 'Add note', icon: NotebookPen },
          { key: 'info', label: 'Exercise details & history', icon: Info },
          { key: 'remove', label: 'Remove exercise', icon: Trash2, destructive: true },
        ]}
        onSelect={(k) => {
          if (k === 'up') run(() => W.moveExercise(exercise.id, -1));
          if (k === 'down') run(() => W.moveExercise(exercise.id, 1));
          if (k === 'rest') setTimeout(() => setRestSheet(true), 350);
          if (k === 'note') setNoteOpen((v) => !v);
          if (k === 'info') router.push({ pathname: '/exercise/[id]', params: { id: exercise.exerciseId } });
          if (k === 'remove') void removeExercise();
        }}
      />
      <OptionSheet
        visible={restSheet}
        title="Rest between sets"
        onClose={() => setRestSheet(false)}
        options={[30, 45, 60, 90, 120, 150, 180, 240, 300].map((sec) => ({ key: String(sec), label: formatDuration(sec * 1000), selected: sec === rest }))}
        onSelect={(k) => run(() => W.setExerciseRest(exercise.id, Number(k)))}
      />
      <OptionSheet
        visible={typeFor != null}
        title={typeFor ? `Set ${typeFor.setNumber} type` : undefined}
        onClose={() => setTypeFor(null)}
        options={SET_TYPES.map((t) => ({ key: t, label: SET_TYPE_LABELS[t], selected: typeFor?.setType === t }))}
        onSelect={(k) => typeFor && run(() => W.updateSet(typeFor.id, { setType: k as SetType }))}
      />
    </Card>
  );
});

function SetRow({
  set,
  unit,
  previous,
  editable,
  onToggle,
  onTypePress,
  onDelete,
}: {
  set: WorkoutSet;
  unit: WeightUnit;
  previous: WorkoutSet | null;
  editable: boolean;
  onToggle: () => void;
  onTypePress: () => void;
  onDelete: () => void;
}) {
  const run = useAction();
  const short = SET_TYPE_SHORT[set.setType];
  const typeColor = set.setType === 'warmup' ? colors.warning : set.setType === 'drop' ? '#5CC8FF' : set.setType === 'failure' ? colors.error : colors.text;
  const diff =
    previous && set.isCompleted && set.weightKg != null && set.reps != null && previous.weightKg != null && previous.reps != null
      ? set.weightKg * set.reps - previous.weightKg * previous.reps
      : null;
  return (
    <Pressable onLongPress={editable ? onDelete : undefined} delayLongPress={400} accessibilityHint={editable ? 'Long press to delete set' : undefined}>
      <Row
        style={{
          paddingVertical: 4,
          paddingHorizontal: 2,
          borderRadius: radius.sm,
          backgroundColor: set.isCompleted ? 'rgba(182,242,58,0.08)' : 'transparent',
        }}
      >
        <Pressable
          onPress={editable ? onTypePress : undefined}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
          accessibilityRole="button"
          accessibilityLabel={`Set ${set.setNumber}, ${SET_TYPE_LABELS[set.setType]}. Change set type`}
        >
          <Text variant="bodyStrong" color={typeColor}>
            {short || set.setNumber}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {previous ? formatSet(previous, unit) : '–'}
          </Text>
          {diff != null && diff !== 0 ? (
            <Text variant="caption" color={diff > 0 ? colors.success : colors.warning} style={{ fontSize: 11 }}>
              {diff > 0 ? '▲' : '▼'} {Math.abs(Math.round(kgToDisplay(diff, unit)))} {unit}
            </Text>
          ) : null}
        </View>
        <NumberInput
          debounceMs={500}
          value={set.weightKg != null ? round(kgToDisplay(set.weightKg, unit), 2) : null}
          onCommit={(v) => run(() => W.updateSet(set.id, { weightKg: v == null ? null : displayToKg(v, unit) }), 'Invalid weight')}
          placeholder="0"
          style={{ width: 66 }}
          accessibilityLabel={`Set ${set.setNumber} weight in ${unit}`}
        />
        <NumberInput
          debounceMs={500}
          value={set.reps}
          decimals={false}
          onCommit={(v) => run(() => W.updateSet(set.id, { reps: v }), 'Invalid reps')}
          placeholder="0"
          style={{ width: 52 }}
          accessibilityLabel={`Set ${set.setNumber} reps`}
        />
        <NumberInput
          debounceMs={500}
          value={set.rpe}
          onCommit={(v) => run(() => W.updateSet(set.id, { rpe: v }), 'Invalid RPE')}
          placeholder="–"
          style={{ width: 44 }}
          accessibilityLabel={`Set ${set.setNumber} RPE`}
        />
        <Pressable
          onPress={() => {
            flushPendingInputs();
            onToggle();
          }}
          style={{
            width: 44,
            height: 40,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: set.isCompleted ? colors.accent : colors.surface,
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.isCompleted }}
          accessibilityLabel={`Mark set ${set.setNumber} ${set.isCompleted ? 'not completed' : 'completed'}`}
        >
          <Check color={set.isCompleted ? colors.onAccent : colors.textSecondary} size={20} strokeWidth={3} />
        </Pressable>
      </Row>
    </Pressable>
  );
}

export function showSetHelp() {
  Alert.alert('Sets', 'Tap the set number to change its type (warm-up, working, drop, failure). Long-press a set to delete it. Warm-up sets do not count toward volume or records.');
}
