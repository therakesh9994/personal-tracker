import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, NumberInput, Row, Screen, Text } from '@/components/ui';
import { getGoalsForDay, setGoals } from '@/features/settings/service';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/errors';

type Key = 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'waterMl';
const FIELDS: { key: Key; label: string; unit: string; int?: boolean }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', int: true },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbohydrates', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
  { key: 'waterMl', label: 'Water', unit: 'ml', int: true },
];

export default function GoalsScreen() {
  const router = useRouter();
  const current = getGoalsForDay();
  const [v, setV] = useState<Record<Key, number | null>>({
    calories: current?.calories ?? null,
    proteinG: current?.proteinG ?? null,
    carbsG: current?.carbsG ?? null,
    fatG: current?.fatG ?? null,
    waterMl: current?.waterMl ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const macroKcal = (v.proteinG ?? 0) * 4 + (v.carbsG ?? 0) * 4 + (v.fatG ?? 0) * 9;
  return (
    <Screen>
      <Text color={colors.textSecondary}>
        Set your own daily targets. Leave a field empty for no goal. Gym Tracker does not calculate or recommend calorie targets; ask a qualified professional if you are unsure.
      </Text>
      <Card>
        {FIELDS.map((f) => (
          <Row key={f.key} style={{ justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }}>{f.label}</Text>
            <NumberInput value={v[f.key]} onCommit={(x) => setV((c) => ({ ...c, [f.key]: x == null ? null : f.int ? Math.round(x) : x }))} decimals={!f.int} placeholder="–" style={{ width: 100 }} accessibilityLabel={`${f.label} goal in ${f.unit}`} />
            <Text variant="caption" color={colors.textSecondary} style={{ width: 32 }}>
              {f.unit}
            </Text>
          </Row>
        ))}
      </Card>
      {macroKcal > 0 ? (
        <Text variant="caption" color={colors.textSecondary}>
          Macro targets add up to about {Math.round(macroKcal)} kcal (4/4/9 kcal per gram).
        </Text>
      ) : null}
      <ErrorText message={error} />
      <Button
        title="Save goals"
        onPress={() => {
          try {
            setGoals(v);
            router.back();
          } catch (e) {
            setError(errorMessage(e));
          }
        }}
      />
      <Text variant="caption" color={colors.textSecondary}>
        New goals apply from today. Past days keep the goals that were active then.
      </Text>
    </Screen>
  );
}
