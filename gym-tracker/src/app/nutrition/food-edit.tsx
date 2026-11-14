import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { Button, Card, ErrorText, Field, NumberInput, Row, Screen, Text } from '@/components/ui';
import { createFood, deleteFood, getFood, updateFood } from '@/features/nutrition/service';
import type { MealType } from '@/database/schema';
import { confirm } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function FoodEdit() {
  const { id, meal, day } = useLocalSearchParams<{ id?: string; meal?: MealType; day?: string }>();
  const router = useRouter();
  const [f] = useState(() => (id ? getFood(id) : null));
  const [name, setName] = useState(f?.name ?? '');
  const [unit, setUnit] = useState(f?.servingUnit ?? 'g');
  const [v, setV] = useState<Record<'servingSize' | 'calories' | 'proteinG' | 'carbsG' | 'fatG', number | null>>(() =>
    f
      ? { servingSize: f.servingSize, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG }
      : { servingSize: 100, calories: null, proteinG: null, carbsG: null, fatG: null },
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    try {
      const input = { name, servingUnit: unit, servingSize: v.servingSize ?? NaN, calories: v.calories ?? 0, proteinG: v.proteinG ?? 0, carbsG: v.carbsG ?? 0, fatG: v.fatG ?? 0 };
      if (id) {
        updateFood(id, input);
        router.back();
      } else {
        const newId = createFood(input);
        if (meal) router.replace({ pathname: '/nutrition/log', params: { foodId: newId, meal, day } });
        else router.back();
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit food' : 'New food' }} />
      <Screen>
        <Card>
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Greek yogurt" autoFocus={!id} maxLength={80} />
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text variant="label" color={colors.textSecondary}>
                Serving size
              </Text>
              <NumberInput value={v.servingSize} onCommit={(x) => setV((cur) => ({ ...cur, servingSize: x }))} style={{ minHeight: 48 }} accessibilityLabel="Serving size" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="g, ml, piece" maxLength={20} />
            </View>
          </Row>
        </Card>
        <Card>
          <Text variant="label" color={colors.textSecondary}>
            Per serving
          </Text>
          <MacroInput label="Calories" suffix="kcal" value={v.calories} onCommit={(x) => setV((c) => ({ ...c, calories: x }))} />
          <MacroInput label="Protein" suffix="g" value={v.proteinG} onCommit={(x) => setV((c) => ({ ...c, proteinG: x }))} />
          <MacroInput label="Carbohydrates" suffix="g" value={v.carbsG} onCommit={(x) => setV((c) => ({ ...c, carbsG: x }))} />
          <MacroInput label="Fat" suffix="g" value={v.fatG} onCommit={(x) => setV((c) => ({ ...c, fatG: x }))} />
        </Card>
        {id ? (
          <Text variant="caption" color={colors.textSecondary}>
            Changes apply to future entries only. Past entries keep the values they were logged with.
          </Text>
        ) : null}
        <ErrorText message={error} />
        <Row>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Save" style={{ flex: 1 }} onPress={save} />
        </Row>
        {id ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Delete food"
              icon={Trash2}
              variant="danger"
              onPress={async () => {
                if (!(await confirm('Delete food?', 'It will be removed from your food list. Logged entries are kept.'))) return;
                deleteFood(id);
                router.back();
              }}
            />
          </View>
        ) : null}
      </Screen>
    </>
  );
}

function MacroInput({ label, suffix, value, onCommit }: { label: string; suffix: string; value: number | null; onCommit: (v: number | null) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <NumberInput value={value} onCommit={onCommit} placeholder="0" style={{ width: 100 }} accessibilityLabel={label} />
      <Text variant="caption" color={colors.textSecondary} style={{ width: 32 }}>
        {suffix}
      </Text>
    </Row>
  );
}
