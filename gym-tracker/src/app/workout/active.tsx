import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, CircleHelp, Dumbbell, Pause, Play, Plus, X } from 'lucide-react-native';
import { Button, Card, EmptyState, Field, IconButton, Row, Screen, Text } from '@/components/ui';
import { ExerciseCard, showSetHelp } from '@/features/workouts/components/ExerciseCard';
import { RestTimerBar } from '@/features/workouts/components/RestTimerBar';
import * as W from '@/features/workouts/service';
import { sessionDurationMs, summarizeSession } from '@/features/workouts/calculations';
import { runAutoBackupIfDue } from '@/features/backup/service';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { useNow } from '@/hooks/useNow';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { confirm, useAction } from '@/hooks/useAction';
import { ensureNotificationPermission } from '@/services/notifications';
import { useRestTimer } from '@/stores/restTimer';
import { colors, spacing, typographyFor } from '@/theme';
import { formatDuration } from '@/utils/time';
import { formatVolume } from '@/utils/units';
import { errorMessage } from '@/utils/errors';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const settings = useSettings();
  const run = useAction();
  const startTimer = useRestTimer((s) => s.start);
  const resetTimer = useRestTimer((s) => s.reset);
  const [finishing, setFinishing] = useState(false);
  const [lastRest, setLastRest] = useState<number | null>(null);

  const { data: detail } = useQuery(() => {
    const open = W.getOpenSession();
    return open ? W.getSessionDetail(open.id) : null;
  });
  const session = detail?.session;
  const now = useNow(1000, session?.status === 'active');

  const previous = useQuery(() => {
    const map: Record<string, ReturnType<typeof W.getPreviousPerformance>> = {};
    for (const e of detail?.exercises ?? []) map[e.exerciseId] ??= W.getPreviousPerformance(e.exerciseId, session?.id);
    return map;
  }, [detail?.exercises.map((e) => e.exerciseId).join(','), session?.id]).data;

  // Latest unsaved notes text (the notes field saves on blur; finish saves whatever is pending).
  const pendingNotes = useRef<string | null>(null);

  useEffect(() => {
    // Ask once; if denied, the timer still alerts in the foreground.
    void ensureNotificationPermission();
  }, []);

  const summary = useMemo(() => (detail ? summarizeSession(detail.exercises) : null), [detail]);

  if (!detail || !session) {
    return (
      <Screen>
        <EmptyState icon={Dumbbell} title="No workout in progress" message="Start a workout from the Workout tab." action="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const paused = session.status === 'paused';
  const incomplete = detail.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.isCompleted).length, 0);

  const finish = async () => {
    if (finishing) return; // guards duplicate taps
    if (summary && summary.completedSets === 0) {
      Alert.alert('Nothing to save', 'Complete at least one set before finishing, or cancel the workout.');
      return;
    }
    const msg = incomplete > 0 ? `${incomplete} incomplete set${incomplete === 1 ? '' : 's'} will be discarded.` : 'Save this workout to your history?';
    if (!(await confirm('Finish workout?', msg, 'Finish', false))) return;
    setFinishing(true);
    try {
      if (pendingNotes.current != null) W.saveNote(session.id, pendingNotes.current);
      const res = W.finishSession(session.id);
      resetTimer();
      void runAutoBackupIfDue('workout_finished');
      router.replace({ pathname: '/workout/[id]', params: { id: res.sessionId, justFinished: String(res.newRecordCount) } });
    } catch (e) {
      Alert.alert('Could not finish workout', errorMessage(e));
      setFinishing(false);
    }
  };

  const cancel = async () => {
    if (!(await confirm('Cancel workout?', 'This workout and all its sets will be permanently discarded.', 'Discard workout'))) return;
    run(() => {
      W.cancelSession(session.id);
      resetTimer();
      router.back();
    });
  };

  const onSetCompleted = (restSeconds: number) => {
    setLastRest(restSeconds);
    if (settings.autoStartRestTimer) startTimer(restSeconds);
  };

  const elapsed = formatDuration(sessionDurationMs(session, now));
  // The workout can be the first screen (e.g. restored route): fall back to the tabs.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon={ChevronLeft} label="Back" onPress={goBack} size={44} />
        <View style={{ alignItems: 'center', gap: 2 }} accessible accessibilityLabel={`Elapsed ${elapsed}${paused ? ', paused' : ''}`}>
          <Text variant="label" color={paused ? colors.warning : colors.textSecondary}>
            {paused ? 'Paused' : 'Elapsed'}
          </Text>
          <Text variant="title" style={{ fontSize: 24, fontVariant: ['tabular-nums'] }}>
            {elapsed}
          </Text>
        </View>
        {paused ? (
          <IconButton icon={Play} label="Resume workout" onPress={() => run(() => W.resumeSession(session.id))} size={44} background={colors.accent} color={colors.onAccent} />
        ) : (
          <IconButton icon={Pause} label="Pause workout" onPress={() => run(() => W.pauseSession(session.id))} size={44} />
        )}
      </View>

      <Screen edges={[]} contentStyle={{ paddingTop: 0, gap: spacing.md }}>
        <View style={{ gap: 2, paddingHorizontal: spacing.xs }}>
          <Row style={{ alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SessionNameField key={`${session.id}:${session.name}`} sessionId={session.id} name={session.name} />
            </View>
            <IconButton icon={CircleHelp} label="How sets work" onPress={showSetHelp} size={36} background="transparent" color={colors.textSecondary} />
          </Row>
          <Text variant="caption" color={colors.textSecondary}>
            {summary?.completedSets ?? 0} sets · {summary?.totalReps ?? 0} reps · {formatVolume(summary?.totalVolumeKg ?? 0, settings.weightUnit)}
          </Text>
        </View>

        <RestTimerBar suggestedSeconds={lastRest ?? settings.defaultRestSeconds} />

        {detail.exercises.length === 0 ? (
          <Card>
            <EmptyState icon={Dumbbell} title="Add your first exercise" message="Pick from the library or create a custom exercise." />
          </Card>
        ) : null}

        {detail.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            sessionId={session.id}
            previous={previous?.[ex.exerciseId] ?? null}
            unit={settings.weightUnit}
            index={i}
            count={detail.exercises.length}
            defaultRest={settings.defaultRestSeconds}
            onSetCompleted={onSetCompleted}
          />
        ))}

        <Card>
          <SessionNotesField key={session.id} sessionId={session.id} initial={detail.sessionNote?.content ?? ''} onPendingChange={(t) => (pendingNotes.current = t)} />
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button title="Cancel workout" icon={X} variant="danger" onPress={cancel} />
          <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            Every change is saved instantly. If the app closes, your workout will be here when you return.
          </Text>
        </View>
      </Screen>

      {/* Hidden while typing so it doesn't cover inputs or eat the space above the keyboard. */}
      {keyboardVisible ? null : (
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Add exercise"
          icon={Plus}
          variant="secondary"
          size="lg"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/exercise', params: { pick: 'session', targetId: session.id } })}
        />
        <Button title="Finish" icon={CheckCircle2} size="lg" style={{ flex: 1 }} onPress={finish} loading={finishing} accessibilityLabel="Finish workout" />
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

function SessionNameField({ sessionId, name }: { sessionId: string; name: string }) {
  const run = useAction();
  const [v, setV] = useState(name);
  return (
    <TextInput
      value={v}
      onChangeText={setV}
      onBlur={() => (v.trim() && v !== name ? run(() => W.renameSession(sessionId, v)) : setV(name))}
      accessibilityLabel="Workout name"
      selectionColor={colors.accent}
      maxLength={80}
      style={{ ...typographyFor('title'), fontSize: 26, color: colors.text, padding: 0 }}
    />
  );
}

function SessionNotesField({ sessionId, initial, onPendingChange }: { sessionId: string; initial: string; onPendingChange: (t: string | null) => void }) {
  const run = useAction();
  const [v, setV] = useState(initial);
  return (
    <Field
      label="Workout notes"
      placeholder="How did it feel? Anything to remember next time?"
      value={v}
      onChangeText={(t) => {
        setV(t);
        onPendingChange(t);
      }}
      onBlur={() =>
        run(() => {
          W.saveNote(sessionId, v);
          onPendingChange(null);
        })
      }
      multiline
    />
  );
}
