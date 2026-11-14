import { useState } from 'react';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { DistributionBars } from '@/components/Charts';
import { Card, IconButton, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { monthlyReport, muscleDistribution, sessionStats } from '@/features/analytics/service';
import { MUSCLE_LABELS } from '@/constants/labels';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatDurationShort, now } from '@/utils/time';
import { formatVolume } from '@/utils/units';

export default function MonthlyReportScreen() {
  const s = useSettings();
  const [month, setMonth] = useState(() => startOfMonth(now()).getTime());
  const report = useQuery(() => monthlyReport(month), [month]).data;
  const prev = useQuery(() => monthlyReport(subMonths(month, 1).getTime()), [month]).data;
  const sessions = useQuery(() => sessionStats(month, addMonths(month, 1).getTime()), [month]).data ?? [];
  const muscles = useQuery(() => muscleDistribution(month, addMonths(month, 1).getTime()), [month]).data ?? [];
  const isCurrent = month >= startOfMonth(now()).getTime();
  if (!report) return <Screen />;
  const delta = (a: number, b: number | undefined) => (b == null || b === 0 ? '' : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs prev`);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => setMonth(subMonths(month, 1).getTime())} />
        <Text variant="title">{format(month, 'MMMM yyyy')}</Text>
        <IconButton icon={ChevronRight} label="Next month" disabled={isCurrent} onPress={() => setMonth(addMonths(month, 1).getTime())} />
      </Row>
      <Row gap={spacing.sm}>
        <StatTile label="Workouts" value={String(report.workouts)} sub={delta(report.workouts, prev?.workouts)} />
        <StatTile label="Volume" value={formatVolume(report.volumeKg, s.weightUnit)} sub={delta(report.volumeKg, prev?.volumeKg)} />
      </Row>
      <Row gap={spacing.sm}>
        <StatTile label="Training time" value={formatDurationShort(report.durationMs)} />
        <StatTile label="Sets" value={String(report.completedSets)} />
        <StatTile label="Records" value={String(report.recordsSet)} accent={report.recordsSet > 0} />
      </Row>
      <Card>
        <SectionHeader title="Nutrition" />
        <Text>
          {report.avgCalories != null ? `Average ${Math.round(report.avgCalories)} kcal on ${report.loggedNutritionDays} logged day${report.loggedNutritionDays === 1 ? '' : 's'}.` : 'No meals logged this month.'}
        </Text>
      </Card>
      {muscles.length > 0 ? (
        <Card>
          <SectionHeader title="Muscle groups this month" />
          <DistributionBars items={muscles.map((m) => ({ label: MUSCLE_LABELS[m.muscle], value: m.sets }))} formatValue={(v) => `${v} sets`} />
        </Card>
      ) : null}
      <Card>
        <SectionHeader title="Sessions" />
        {sessions.length === 0 ? (
          <Text color={colors.textSecondary}>No workouts this month.</Text>
        ) : (
          sessions.map((x) => (
            <Row key={x.id} style={{ justifyContent: 'space-between' }}>
              <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                {format(x.startedAt, 'd MMM')} · {x.name}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {formatVolume(x.volumeKg, s.weightUnit)}
              </Text>
            </Row>
          ))
        )}
      </Card>
    </Screen>
  );
}
