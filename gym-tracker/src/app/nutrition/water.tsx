import { FlatList } from 'react-native';
import { format } from 'date-fns';
import { Droplets } from 'lucide-react-native';
import { BarChart } from '@/components/Charts';
import { Card, EmptyState, ProgressBar, Row, Text } from '@/components/ui';
import { getWaterHistory } from '@/features/nutrition/service';
import { getGoalsForDay } from '@/features/settings/service';
import { useQuery } from '@/hooks/useQuery';
import { colors, spacing } from '@/theme';

const parseDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).getTime();
};

export default function WaterHistory() {
  const history = useQuery(() => getWaterHistory(90)).data ?? [];
  const goal = useQuery(() => getGoalsForDay()).data?.waterMl ?? null;
  const last14 = [...history].slice(0, 14).reverse();
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
      data={history}
      keyExtractor={(d) => d.day}
      ListHeaderComponent={
        <Card style={{ marginBottom: spacing.sm }}>
          <Text variant="label" color={colors.textSecondary}>
            Recent days
          </Text>
          <BarChart points={last14.map((d) => ({ label: format(parseDay(d.day), 'd/M'), value: d.totalMl }))} color="#5CC8FF" height={160} accessibilityLabel="Daily water intake" />
        </Card>
      }
      ListEmptyComponent={<EmptyState icon={Droplets} title="No water logged yet" />}
      renderItem={({ item }) => (
        <Card style={{ gap: spacing.xs, paddingVertical: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text>{format(parseDay(item.day), 'EEE d MMM yyyy')}</Text>
            <Text variant="bodyStrong">{item.totalMl} ml</Text>
          </Row>
          {goal ? <ProgressBar progress={item.totalMl / goal} color="#5CC8FF" height={6} /> : null}
        </Card>
      )}
    />
  );
}
