import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, CalendarDays, Copy, Play, Plus, Trash2 } from 'lucide-react-native';
import { OptionSheet } from '@/components/OptionSheet';
import { Button, Card, EmptyState, Field, IconButton, NumberInput, Row, Screen, Text } from '@/components/ui';
import { WEEKDAYS } from '@/constants/labels';
import * as P from '@/features/plans/service';
import { useStartWorkout } from '@/features/workouts/useStartWorkout';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { confirm, useAction } from '@/hooks/useAction';
import { colors, font, spacing } from '@/theme';
import { displayToKg, kgToDisplay, round } from '@/utils/units';

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const run = useAction();
  const start = useStartWorkout();
  const settings = useSettings();
  const detail = useQuery(() => P.getPlanDetail(id), [id]).data;
  const [weekdayFor, setWeekdayFor] = useState<string | null>(null);

  if (!detail) return <Screen><EmptyState title="Plan not found" /></Screen>;
  const u = settings.weightUnit;

  const del = async () => {
    if (!(await confirm('Delete plan?', 'Workouts already done from this plan stay in your history.'))) return;
    run(() => {
      P.deletePlan(id);
      router.back();
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: detail.plan.name }} />
      <Screen>
        <PlanFields key={detail.plan.id} planId={id} initialName={detail.plan.name} initialDescription={detail.plan.description} />

        {detail.days.map((day, di) => (
          <Card key={day.id}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <DayName key={`${day.id}:${day.name}`} dayId={day.id} name={day.name} />
              </View>
              <IconButton icon={CalendarDays} label="Schedule weekday" onPress={() => setWeekdayFor(day.id)} color={day.dayOfWeek != null ? colors.accent : colors.text} />
              <IconButton
                icon={Trash2}
                label={`Delete ${day.name}`}
                color={colors.error}
                onPress={async () => (await confirm('Delete day?', `${day.name} and its exercises will be removed from the plan.`)) && run(() => P.deleteDay(day.id))}
              />
            </Row>
            <Text variant="caption" color={colors.textSecondary}>
              Day {di + 1}
              {day.dayOfWeek != null ? ` · every ${WEEKDAYS[day.dayOfWeek]}` : ' · unscheduled'} · {day.exercises.length} exercises
            </Text>

            {day.exercises.map((pe, i) => (
              <View key={pe.id} style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Row>
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {pe.exerciseName}
                  </Text>
                  <IconButton icon={ArrowUp} label="Move up" size={32} disabled={i === 0} onPress={() => run(() => P.movePlanExercise(pe.id, -1))} />
                  <IconButton icon={ArrowDown} label="Move down" size={32} disabled={i === day.exercises.length - 1} onPress={() => run(() => P.movePlanExercise(pe.id, 1))} />
                  <IconButton icon={Trash2} label={`Remove ${pe.exerciseName}`} size={32} color={colors.error} onPress={() => run(() => P.removePlanExercise(pe.id))} />
                </Row>
                <Row gap={spacing.xs}>
                  <Target label="Sets" value={pe.targetSets} onCommit={(v) => v != null && run(() => P.updatePlanExercise(pe.id, { targetSets: v }))} />
                  <Target label="Reps" value={pe.targetReps} onCommit={(v) => v != null && run(() => P.updatePlanExercise(pe.id, { targetReps: v }))} />
                  <Target label="Max" value={pe.targetRepsMax} onCommit={(v) => run(() => P.updatePlanExercise(pe.id, { targetRepsMax: v }))} />
                  <Target label="Rest s" value={pe.restSeconds} onCommit={(v) => v != null && run(() => P.updatePlanExercise(pe.id, { restSeconds: v }))} />
                  <Target
                    label={u}
                    decimals
                    value={pe.targetWeightKg != null ? round(kgToDisplay(pe.targetWeightKg, u), 2) : null}
                    onCommit={(v) => run(() => P.updatePlanExercise(pe.id, { targetWeightKg: v == null ? null : displayToKg(v, u) }))}
                  />
                </Row>
              </View>
            ))}
            <Row>
              <Button title="Add exercise" icon={Plus} size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/exercise', params: { pick: 'plan', targetId: day.id } })} />
              <Button title="Start" icon={Play} size="sm" disabled={day.exercises.length === 0} onPress={() => start({ planDayId: day.id })} />
            </Row>
          </Card>
        ))}

        <Button title="Add training day" icon={Plus} variant="secondary" onPress={() => run(() => P.addDay(id))} />
        <Button
          title="Duplicate plan"
          icon={Copy}
          variant="ghost"
          onPress={() =>
            run(() => {
              const copy = P.duplicatePlan(id);
              router.replace({ pathname: '/plans/[id]', params: { id: copy } });
            })
          }
        />
        <Button title="Delete plan" icon={Trash2} variant="danger" onPress={del} />

        <OptionSheet
          visible={weekdayFor != null}
          title="Schedule this day"
          message="Scheduled days appear as “Today's workout” on the Home screen."
          onClose={() => setWeekdayFor(null)}
          options={[{ key: 'none', label: 'Not scheduled' }, ...WEEKDAYS.map((d, i) => ({ key: String(i), label: d }))]}
          onSelect={(k) => weekdayFor && run(() => P.updateDay(weekdayFor, { dayOfWeek: k === 'none' ? null : Number(k) }))}
        />
      </Screen>
    </>
  );
}

function PlanFields({ planId, initialName, initialDescription }: { planId: string; initialName: string; initialDescription: string }) {
  const run = useAction();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  const save = () => run(() => P.updatePlan(planId, { name, description: desc }));
  return (
    <Card>
      <Field label="Plan name" value={name} onChangeText={setName} onBlur={save} maxLength={80} />
      <Field label="Description" value={desc} onChangeText={setDesc} onBlur={save} multiline maxLength={500} />
    </Card>
  );
}

/** Keyed by name so it re-initialises when the stored name changes. */
function DayName({ dayId, name }: { dayId: string; name: string }) {
  const run = useAction();
  const [v, setV] = useState(name);
  return <Field value={v} onChangeText={setV} onBlur={() => v !== name && run(() => P.updateDay(dayId, { name: v }))} accessibilityLabel="Day name" style={font('bold')} />;
}

function Target({ label, value, onCommit, decimals = false }: { label: string; value: number | null; onCommit: (v: number | null) => void; decimals?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label" color={colors.textSecondary} style={{ textAlign: 'center', fontSize: 10 }}>
        {label}
      </Text>
      <NumberInput value={value} onCommit={onCommit} decimals={decimals} placeholder="–" accessibilityLabel={label} debounceMs={500} />
    </View>
  );
}
