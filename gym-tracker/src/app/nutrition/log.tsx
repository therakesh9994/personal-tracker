import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react-native';
import { Button, Card, Chip, EmptyState, ErrorText, NumberInput, Row, Screen, Segmented, Text } from '@/components/ui';
import { MEAL_TYPES, type MealType } from '@/database/schema';
import { MEAL_LABELS, deleteEntry, getEntry, getFood, logFood, updateEntry } from '@/features/nutrition/service';
import { entryTotals } from '@/features/nutrition/calculations';
import { confirm } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { round } from '@/utils/units';
import { errorMessage } from '@/utils/errors';
import { now } from '@/utils/time';

/** Log a food (?foodId&meal&day) or edit an existing entry (?entryId). */
export default function LogFood() {
  const { foodId, meal: mealParam, day, entryId } = useLocalSearchParams<{ foodId?: string; meal?: MealType; day?: string; entryId?: string }>();
  const router = useRouter();
  const entry = entryId ? getEntry(entryId) : null;
  const food = foodId ? getFood(foodId) : null;
  const base = entry
    ? { name: entry.foodName, servingSize: entry.servingSize, servingUnit: entry.servingUnit, calories: entry.caloriesPerServing, protein: entry.proteinPerServing, carbs: entry.carbsPerServing, fat: entry.fatPerServing }
    : food
      ? { name: food.name, servingSize: food.servingSize, servingUnit: food.servingUnit, calories: food.calories, protein: food.proteinG, carbs: food.carbsG, fat: food.fatG }
      : null;
  const [meal, setMeal] = useState<MealType>(entry?.meal ?? mealParam ?? 'snack');
  const [mode, setMode] = useState<'servings' | 'amount'>('servings');
  const [servings, setServings] = useState<number | null>(entry?.quantity ?? 1);
  const [error, setError] = useState<string | null>(null);

  if (!base) return <Screen><EmptyState title="Food not found" /></Screen>;
  const quantity = servings ?? 0;
  const totals = entryTotals({ meal, quantity, caloriesPerServing: base.calories, proteinPerServing: base.protein, carbsPerServing: base.carbs, fatPerServing: base.fat });

  const save = () => {
    try {
      if (entry) {
        updateEntry(entry.id, { quantity, meal });
        router.back();
      } else {
        logFood({ foodId: foodId!, meal, quantity, loggedAt: day ? Number(day) : now() });
        router.dismissTo('/(tabs)/nutrition');
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: entry ? 'Edit entry' : 'Log food' }} />
      <Screen>
        <Card>
          <Text variant="title">{base.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {round(base.servingSize, 1)} {base.servingUnit} per serving · {Math.round(base.calories)} kcal
            {entry ? ` · logged ${format(entry.loggedAt, 'd MMM HH:mm')} (values as logged)` : ''}
          </Text>
        </Card>
        <Card>
          <Segmented
            options={[
              { key: 'servings', label: 'Servings' },
              { key: 'amount', label: base.servingUnit },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
          />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text>{mode === 'servings' ? 'Number of servings' : `Amount (${base.servingUnit})`}</Text>
            <NumberInput
              key={mode}
              value={servings == null ? null : mode === 'servings' ? round(servings, 2) : round(servings * base.servingSize, 1)}
              onCommit={(v) => {
                setServings(v == null ? null : mode === 'servings' ? v : v / base.servingSize);
                setError(null);
              }}
              style={{ width: 110 }}
              accessibilityLabel={mode === 'servings' ? 'Number of servings' : `Amount in ${base.servingUnit}`}
            />
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {[0.5, 1, 1.5, 2].map((q) => (
              <Chip key={q} label={`${q}×`} selected={servings === q} onPress={() => setServings(q)} />
            ))}
          </Row>
        </Card>
        <Card>
          <Text variant="label" color={colors.textSecondary}>
            Meal
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {MEAL_TYPES.map((m) => (
              <Chip key={m} label={MEAL_LABELS[m]} selected={meal === m} onPress={() => setMeal(m)} />
            ))}
          </View>
        </Card>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="heading">Total</Text>
            <Text variant="title" color={colors.accent}>
              {Math.round(totals.calories)} kcal
            </Text>
          </Row>
          <Text color={colors.textSecondary}>
            Protein {round(totals.protein, 1)}g · Carbs {round(totals.carbs, 1)}g · Fat {round(totals.fat, 1)}g
          </Text>
        </Card>
        <ErrorText message={error} />
        <Button title={entry ? 'Save changes' : 'Add to log'} size="lg" onPress={save} />
        {entry ? (
          <Button
            title="Delete entry"
            icon={Trash2}
            variant="danger"
            onPress={async () => {
              if (!(await confirm('Delete entry?', `${entry.foodName} will be removed.`))) return;
              deleteEntry(entry.id);
              router.back();
            }}
          />
        ) : null}
      </Screen>
    </>
  );
}
