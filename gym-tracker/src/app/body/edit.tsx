import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, subDays, addDays, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { Button, Card, ErrorText, Field, IconButton, NumberInput, Row, Screen, Text } from '@/components/ui';
import { MEASUREMENT_FIELDS, addMeasurement, deleteMeasurement, getMeasurement, updateMeasurement, type MeasurementKey } from '@/features/measurements/service';
import { useSettings } from '@/hooks/useSettings';
import { confirm } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay, round } from '@/utils/units';
import { errorMessage } from '@/utils/errors';
import { now } from '@/utils/time';

type Values = Record<MeasurementKey, number | null>;
const empty = (): Values => Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, null])) as Values;

export default function EditMeasurement() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const s = useSettings();
  const [initial] = useState(() => (id ? getMeasurement(id) : null));
  const [date, setDate] = useState(() => initial?.measuredAt ?? now());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const toDisplay = (key: MeasurementKey, v: number) => {
    const kind = MEASUREMENT_FIELDS.find((f) => f.key === key)!.kind;
    return kind === 'weight' ? kgToDisplay(v, s.weightUnit) : kind === 'length' ? cmToDisplay(v, s.lengthUnit) : v;
  };
  const fromDisplay = (key: MeasurementKey, v: number) => {
    const kind = MEASUREMENT_FIELDS.find((f) => f.key === key)!.kind;
    return kind === 'weight' ? displayToKg(v, s.weightUnit) : kind === 'length' ? displayToCm(v, s.lengthUnit) : v;
  };

  // Values are kept in display units while editing.
  const [values, setValues] = useState<Values>(() => {
    const v = empty();
    if (initial) for (const f of MEASUREMENT_FIELDS) v[f.key] = initial[f.key] != null ? round(toDisplay(f.key, initial[f.key]!), 2) : null;
    return v;
  });

  const save = () => {
    setError(null);
    try {
      const stored = Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, values[f.key] == null ? null : fromDisplay(f.key, values[f.key]!)])) as Values;
      const input = { measuredAt: date, notes, ...stored };
      if (id) updateMeasurement(id, input);
      else addMeasurement(input);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const unitFor = (key: MeasurementKey) => {
    const kind = MEASUREMENT_FIELDS.find((f) => f.key === key)!.kind;
    return kind === 'weight' ? s.weightUnit : kind === 'percent' ? '%' : s.lengthUnit;
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit measurement' : 'New measurement' }} />
      <Screen>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconButton icon={ChevronLeft} label="Previous day" onPress={() => setDate((d) => subDays(d, 1).getTime())} />
            <Text variant="heading">{format(date, 'EEE d MMM yyyy')}</Text>
            <IconButton icon={ChevronRight} label="Next day" disabled={startOfDay(date).getTime() >= startOfDay(now()).getTime()} onPress={() => setDate((d) => addDays(d, 1).getTime())} />
          </Row>
          <Text variant="caption" color={colors.textSecondary}>
            All fields are optional — fill in what you measured.
          </Text>
        </Card>
        <Card>
          {MEASUREMENT_FIELDS.map((f) => (
            <Row key={f.key} style={{ justifyContent: 'space-between' }}>
              <Text style={{ flex: 1 }}>{f.label}</Text>
              <NumberInput
                value={values[f.key]}
                onCommit={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
                placeholder="–"
                style={{ width: 96 }}
                accessibilityLabel={`${f.label} in ${unitFor(f.key)}`}
              />
              <Text variant="caption" color={colors.textSecondary} style={{ width: 28 }}>
                {unitFor(f.key)}
              </Text>
            </Row>
          ))}
        </Card>
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={500} />
        <ErrorText message={error} />
        <Row>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Save" style={{ flex: 1 }} onPress={save} />
        </Row>
        {id ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Delete measurement"
              icon={Trash2}
              variant="danger"
              onPress={async () => {
                if (!(await confirm('Delete measurement?', 'This entry will be permanently removed.'))) return;
                deleteMeasurement(id);
                router.back();
              }}
            />
          </View>
        ) : null}
      </Screen>
    </>
  );
}
