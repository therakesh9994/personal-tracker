import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Search, Utensils } from 'lucide-react-native';
import { Card, EmptyState, Field, IconButton, Row, Text } from '@/components/ui';
import { MEAL_LABELS, listFoods } from '@/features/nutrition/service';
import type { MealType } from '@/database/schema';
import { useQuery } from '@/hooks/useQuery';
import { colors, spacing } from '@/theme';
import { round } from '@/utils/units';

/** Food list. With ?meal=…&day=… tapping a food opens the logging screen. */
export default function FoodsScreen() {
  const { meal, day } = useLocalSearchParams<{ meal?: MealType; day?: string }>();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const foods = useQuery(() => listFoods(search), [search]).data ?? [];
  const picking = !!meal;
  return (
    <>
      <Stack.Screen
        options={{
          title: picking ? `Add to ${MEAL_LABELS[meal!]}` : 'My foods',
          headerRight: () => <IconButton icon={Plus} label="Create food" size={34} background="transparent" color={colors.accent} onPress={() => router.push({ pathname: '/nutrition/food-edit', params: picking ? { meal, day } : {} })} />,
        }}
      />
      <FlatList
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        data={foods}
        keyExtractor={(f) => f.id}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Row>
              <Search color={colors.textSecondary} size={18} />
              <View style={{ flex: 1 }}>
                <Field placeholder="Search your foods" value={search} onChangeText={setSearch} autoCorrect={false} />
              </View>
            </Row>
            <Text variant="caption" color={colors.textSecondary}>
              Foods are entered manually and stored on this device. Recently used foods appear first.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Utensils}
            title={search ? 'No matching foods' : 'No foods yet'}
            message="Create a food once with its serving size and macros, then reuse it any time."
            action="Create food"
            onAction={() => router.push({ pathname: '/nutrition/food-edit', params: picking ? { meal, day } : {} })}
          />
        }
        renderItem={({ item: f }) => (
          <Card
            onPress={() =>
              picking
                ? router.push({ pathname: '/nutrition/log', params: { foodId: f.id, meal, day } })
                : router.push({ pathname: '/nutrition/food-edit', params: { id: f.id } })
            }
            style={{ gap: 2, paddingVertical: spacing.md }}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {f.name}
              </Text>
              <Text variant="bodyStrong" color={colors.accent}>
                {Math.round(f.calories)} kcal
              </Text>
            </Row>
            <Text variant="caption" color={colors.textSecondary}>
              per {round(f.servingSize, 1)} {f.servingUnit} · P {round(f.proteinG, 1)}g · C {round(f.carbsG, 1)}g · F {round(f.fatG, 1)}g
            </Text>
          </Card>
        )}
      />
    </>
  );
}
