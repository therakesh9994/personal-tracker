import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, ErrorText, Field, NumberInput, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '@/constants/labels';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS, type Equipment, type ExerciseType, type MuscleGroup } from '@/database/schema';
import { createCustomExercise, getExercise, parseSecondary, updateCustomExercise } from '@/features/exercises/service';
import { colors, spacing } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function EditExercise() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [ex] = useState(() => (id ? getExercise(id) : null));
  const [name, setName] = useState(ex?.name ?? '');
  const [primary, setPrimary] = useState<MuscleGroup | null>(ex?.primaryMuscle ?? null);
  const [secondary, setSecondary] = useState<MuscleGroup[]>(() => (ex ? parseSecondary(ex) : []));
  const [equipment, setEquipment] = useState<Equipment | null>(ex?.equipment ?? null);
  const [type, setType] = useState<ExerciseType>(ex?.exerciseType ?? 'strength');
  const [instructions, setInstructions] = useState(ex?.instructions ?? '');
  const [rest, setRest] = useState<number | null>(ex?.defaultRestSeconds ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    try {
      const input = {
        name,
        primaryMuscle: primary as MuscleGroup,
        secondaryMuscles: secondary,
        equipment: equipment as Equipment,
        exerciseType: type,
        instructions,
        defaultRestSeconds: rest,
      };
      if (id) updateCustomExercise(id, input);
      else createCustomExercise(input);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit exercise' : 'New exercise' }} />
      <Screen>
        <Card>
          <Field label="Name" placeholder="e.g. Landmine Press" value={name} onChangeText={setName} autoFocus={!id} maxLength={80} />
          <Field label="Instructions (optional)" value={instructions} onChangeText={setInstructions} multiline maxLength={2000} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" color={colors.textSecondary}>
              Default rest (seconds, optional)
            </Text>
            <NumberInput value={rest} onCommit={setRest} decimals={false} placeholder="Use app default" style={{ textAlign: 'left', paddingHorizontal: spacing.md, minHeight: 48 }} />
          </View>
        </Card>
        <Card>
          <SectionHeader title="Primary muscle" />
          <Wrap>
            {MUSCLE_GROUPS.map((m) => (
              <Chip key={m} label={MUSCLE_LABELS[m]} selected={primary === m} onPress={() => setPrimary(m)} />
            ))}
          </Wrap>
          <SectionHeader title="Secondary muscles" />
          <Wrap>
            {MUSCLE_GROUPS.filter((m) => m !== primary).map((m) => (
              <Chip key={m} label={MUSCLE_LABELS[m]} selected={secondary.includes(m)} onPress={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))} />
            ))}
          </Wrap>
          <SectionHeader title="Equipment" />
          <Wrap>
            {EQUIPMENT.map((m) => (
              <Chip key={m} label={EQUIPMENT_LABELS[m]} selected={equipment === m} onPress={() => setEquipment(m)} />
            ))}
          </Wrap>
          <SectionHeader title="Type" />
          <Wrap>
            {EXERCISE_TYPES.map((m) => (
              <Chip key={m} label={EXERCISE_TYPE_LABELS[m]} selected={type === m} onPress={() => setType(m)} />
            ))}
          </Wrap>
        </Card>
        <ErrorText message={error} />
        <Row>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Save" style={{ flex: 1 }} onPress={save} />
        </Row>
      </Screen>
    </>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}
