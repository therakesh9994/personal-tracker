import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Trophy } from 'lucide-react-native';
import { Card, EmptyState, Row, Text } from '@/components/ui';
import { listAllRecords, RECORD_LABELS } from '@/features/personal-records/service';
import { RECORD_TYPES } from '@/database/schema';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatWeight } from '@/utils/units';

export default function RecordsScreen() {
  const router = useRouter();
  const s = useSettings();
  const recordsData = useQuery(listAllRecords).data;
  const sections = useMemo(() => {
    const records = recordsData ?? [];
    const map = new Map<string, { title: string; exerciseId: string; data: typeof records }>();
    for (const r of records) {
      const sec = map.get(r.exerciseId) ?? { title: r.exerciseName, exerciseId: r.exerciseId, data: [] };
      sec.data.push(r);
      map.set(r.exerciseId, sec);
    }
    for (const sec of map.values()) sec.data.sort((a, b) => RECORD_TYPES.indexOf(a.recordType) - RECORD_TYPES.indexOf(b.recordType));
    return [...map.values()];
  }, [recordsData]);

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      sections={sections}
      keyExtractor={(r) => r.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Records are detected automatically from completed working sets. Warm-up sets are excluded. Estimated 1RM uses the Epley formula and is labelled as an estimate.
        </Text>
      }
      ListEmptyComponent={<EmptyState icon={Trophy} title="No records yet" message="Finish a workout to set your first personal records." />}
      renderSectionHeader={({ section }) => (
        <Text variant="heading" color={colors.accent} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: section.exerciseId } })}>
          {section.title}
        </Text>
      )}
      renderItem={({ item: r }) => (
        <Card
          style={{ marginBottom: spacing.sm, paddingVertical: spacing.md, gap: 2 }}
          onPress={r.sessionId ? () => router.push({ pathname: '/workout/[id]', params: { id: r.sessionId! } }) : undefined}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textSecondary}>
              {RECORD_LABELS[r.recordType]}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {format(r.achievedAt, 'd MMM yyyy')}
            </Text>
          </Row>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text variant="title">{r.recordType === 'max_reps' ? `${r.value} reps` : formatWeight(r.value, s.weightUnit)}</Text>
            {r.isEstimate ? (
              <Text variant="label" color={colors.warning}>
                Estimate
              </Text>
            ) : null}
          </View>
          {r.weightKg != null && r.reps != null ? (
            <Text variant="caption" color={colors.textSecondary}>
              From set: {formatWeight(r.weightKg, s.weightUnit)} × {r.reps}
            </Text>
          ) : null}
        </Card>
      )}
    />
  );
}
