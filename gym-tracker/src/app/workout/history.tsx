import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { History } from 'lucide-react-native';
import { Card, EmptyState, Row, Text } from '@/components/ui';
import * as W from '@/features/workouts/service';
import type { HistoryItem } from '@/features/workouts/repository';
import { useDataVersion } from '@/stores/dataStore';
import { sessionDurationMs } from '@/features/workouts/calculations';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatDurationShort } from '@/utils/time';
import { formatVolume } from '@/utils/units';

const PAGE = 30;
const NO_ITEMS: HistoryItem[] = [];

export default function HistoryScreen() {
  const router = useRouter();
  const settings = useSettings();
  const version = useDataVersion((st) => st.version);
  const firstPage = useQuery(() => W.listHistory({ limit: PAGE })).data;
  // Later pages are fetched by keyset cursor (each query reads only one page). They belong
  // to the data version they were loaded under, so any write resets the list to page one.
  const [more, setMore] = useState<{ version: number; items: HistoryItem[]; done: boolean }>({ version: -1, items: [], done: false });
  const extra = more.version === version ? more : { items: NO_ITEMS, done: false };
  const items = useMemo(() => [...(firstPage ?? []), ...extra.items], [firstPage, extra.items]);
  const hasMore = !extra.done && (firstPage?.length ?? 0) === PAGE;
  const loadMore = () => {
    const last = items[items.length - 1];
    if (!hasMore || !last) return;
    const page = W.listHistory({ limit: PAGE, after: { startedAt: last.startedAt, id: last.id } });
    setMore({ version, items: [...extra.items, ...page], done: page.length < PAGE });
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
      data={items}
      keyExtractor={(i) => i.id}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      ListEmptyComponent={<EmptyState icon={History} title="No workouts yet" message="Finished workouts are listed here." />}
      renderItem={({ item: w, index }) => {
        const prev = items[index - 1];
        const showMonth = !prev || format(prev.startedAt, 'yyyy-MM') !== format(w.startedAt, 'yyyy-MM');
        return (
          <View style={{ gap: spacing.sm }}>
            {showMonth ? (
              <Text variant="label" color={colors.textSecondary} style={{ marginTop: index ? spacing.md : 0 }}>
                {format(w.startedAt, 'MMMM yyyy')}
              </Text>
            ) : null}
            <Card onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} style={{ gap: spacing.xs }} accessibilityLabel={`${w.name}, ${format(w.startedAt, 'PPP')}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {w.name}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {format(w.startedAt, 'EEE d MMM, HH:mm')}
                </Text>
              </Row>
              <Text variant="caption" color={colors.textSecondary}>
                {formatDurationShort(sessionDurationMs({ ...w, pausedAt: null }))} · {w.exerciseCount} exercises · {w.completedSets} sets ·{' '}
                {formatVolume(w.volumeKg, settings.weightUnit)}
              </Text>
            </Card>
          </View>
        );
      }}
    />
  );
}
