import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Search, Star } from 'lucide-react-native';
import { Card, ChipRow, EmptyState, Field, IconButton, Row, Text, Chip } from '@/components/ui';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/constants/labels';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from '@/database/schema';
import { listExercises, toggleFavorite } from '@/features/exercises/service';
import { addExercise } from '@/features/workouts/service';
import { addPlanExercise } from '@/features/plans/service';
import { useQuery } from '@/hooks/useQuery';
import { useAction } from '@/hooks/useAction';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';

/** Exercise library. With ?pick=session|plan&targetId=… it acts as a picker. */
export default function ExerciseLibrary() {
  const { pick, targetId } = useLocalSearchParams<{ pick?: 'session' | 'plan'; targetId?: string }>();
  const router = useRouter();
  const run = useAction();
  const settings = useSettings();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { data = [] } = useQuery(() => listExercises({ search, muscle, equipment, favoritesOnly }), [search, muscle, equipment, favoritesOnly]);

  const onSelect = (id: string) => {
    if (pick === 'session' && targetId) {
      run(() => {
        addExercise(targetId, id);
        router.back();
      });
    } else if (pick === 'plan' && targetId) {
      run(() => {
        addPlanExercise(targetId, id, { restSeconds: settings.defaultRestSeconds });
        router.back();
      });
    } else {
      router.push({ pathname: '/exercise/[id]', params: { id } });
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: pick ? 'Add exercise' : 'Exercise library',
          headerRight: () => <IconButton icon={Plus} label="Create custom exercise" onPress={() => router.push('/exercise/edit')} size={34} background="transparent" color={colors.accent} />,
        }}
      />
      <FlatList
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        data={data}
        keyExtractor={(e) => e.id}
        initialNumToRender={15}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <Row>
              <Search color={colors.textSecondary} size={18} />
              <View style={{ flex: 1 }}>
                <Field placeholder="Search exercises" value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" accessibilityLabel="Search exercises" />
              </View>
            </Row>
            <ChipRow options={MUSCLE_GROUPS.map((m) => ({ key: m, label: MUSCLE_LABELS[m] }))} value={muscle} onChange={setMuscle} allowNone />
            <ChipRow options={EQUIPMENT.map((m) => ({ key: m, label: EQUIPMENT_LABELS[m] }))} value={equipment} onChange={setEquipment} allowNone />
            <Row>
              <Chip label="★ Favorites" selected={favoritesOnly} onPress={() => setFavoritesOnly((v) => !v)} />
              <Text variant="caption" color={colors.textSecondary}>
                {data.length} exercises
              </Text>
            </Row>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Search} title="No exercises found" message="Try a different search or create a custom exercise." action="Create exercise" onAction={() => router.push('/exercise/edit')} />}
        renderItem={({ item }) => (
          <Card onPress={() => onSelect(item.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }} accessibilityLabel={pick ? `Add ${item.name}` : item.name}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{item.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {MUSCLE_LABELS[item.primaryMuscle]} · {EQUIPMENT_LABELS[item.equipment]}
                {item.isCustom ? ' · Custom' : ''}
              </Text>
            </View>
            <Pressable onPress={() => run(() => toggleFavorite(item.id))} hitSlop={12} accessibilityRole="button" accessibilityLabel={item.isFavorite ? `Unfavorite ${item.name}` : `Favorite ${item.name}`}>
              <Star color={item.isFavorite ? colors.warning : colors.textSecondary} fill={item.isFavorite ? colors.warning : 'transparent'} size={20} />
            </Pressable>
          </Card>
        )}
      />
    </>
  );
}
