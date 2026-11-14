import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { GitCompare, Plus, Ruler } from 'lucide-react-native';
import { LineChart } from '@/components/Charts';
import { Button, Card, ChipRow, EmptyState, IconButton, Row, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { MEASUREMENT_FIELDS, listMeasurements, measurementSeries, type MeasurementKey } from '@/features/measurements/service';
import type { BodyMeasurement } from '@/database/schema';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '@/utils/time';
import { cmToDisplay, kgToDisplay, round, type LengthUnit, type WeightUnit } from '@/utils/units';

export function formatMeasurement(key: MeasurementKey, v: number | null, w: WeightUnit, l: LengthUnit): string {
  if (v == null) return '–';
  const f = MEASUREMENT_FIELDS.find((x) => x.key === key)!;
  if (f.kind === 'weight') return `${round(kgToDisplay(v, w), 1)} ${w}`;
  if (f.kind === 'percent') return `${round(v, 1)}%`;
  return `${round(cmToDisplay(v, l), 1)} ${l}`;
}

function toDisplay(key: MeasurementKey, v: number, w: WeightUnit, l: LengthUnit) {
  const f = MEASUREMENT_FIELDS.find((x) => x.key === key)!;
  return f.kind === 'weight' ? kgToDisplay(v, w) : f.kind === 'percent' ? v : cmToDisplay(v, l);
}

const PAGE = 40;

export default function MeasurementsScreen() {
  const router = useRouter();
  const s = useSettings();
  const [field, setField] = useState<MeasurementKey>('weightKg');
  const [range, setRange] = useState<RangeKey>('90d');
  const [limit, setLimit] = useState(PAGE);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const list = useQuery(() => listMeasurements({ limit }), [limit]).data ?? [];
  const series = useQuery(() => measurementSeries(field, rangeStart(range)), [field, range]).data ?? [];
  const selected = compare.map((id) => list.find((m) => m.id === id)).filter(Boolean) as BodyMeasurement[];
  const [a, b] = [...selected].sort((x, y) => x.measuredAt - y.measuredAt);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <IconButton icon={Plus} label="Add measurement" onPress={() => router.push('/body/edit')} size={34} background="transparent" color={colors.accent} /> }} />
      <Screen>
        <Card>
          <ChipRow options={MEASUREMENT_FIELDS.map((f) => ({ key: f.key, label: f.label }))} value={field} onChange={(v) => v && setField(v)} />
          <LineChart
            points={series.map((p) => ({ label: format(p.x, 'd/M'), value: round(toDisplay(field, p.y, s.weightUnit, s.lengthUnit), 1) }))}
            emptyTitle="No entries in this range"
            emptyMessage="Add measurements to track your trend."
            accessibilityLabel={`${MEASUREMENT_FIELDS.find((f) => f.key === field)!.label} trend`}
          />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </Card>

        <Row style={{ justifyContent: 'space-between' }}>
          <SectionHeader title="History" />
          <Button
            title={comparing ? 'Done' : 'Compare dates'}
            icon={GitCompare}
            size="sm"
            variant={comparing ? 'primary' : 'secondary'}
            onPress={() => {
              setComparing((v) => !v);
              setCompare([]);
            }}
          />
        </Row>
        {comparing ? (
          <Text variant="caption" color={colors.textSecondary}>
            Select two entries to compare.
          </Text>
        ) : null}

        {a && b ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label" color={colors.textSecondary} style={{ flex: 1.2 }}>
                Measurement
              </Text>
              <Text variant="label" color={colors.textSecondary} style={{ flex: 1, textAlign: 'right' }}>
                {format(a.measuredAt, 'd MMM yy')}
              </Text>
              <Text variant="label" color={colors.textSecondary} style={{ flex: 1, textAlign: 'right' }}>
                {format(b.measuredAt, 'd MMM yy')}
              </Text>
              <Text variant="label" color={colors.textSecondary} style={{ flex: 0.9, textAlign: 'right' }}>
                Change
              </Text>
            </Row>
            {MEASUREMENT_FIELDS.filter((f) => a[f.key] != null || b[f.key] != null).map((f) => {
              const d = a[f.key] != null && b[f.key] != null ? toDisplay(f.key, b[f.key]!, s.weightUnit, s.lengthUnit) - toDisplay(f.key, a[f.key]!, s.weightUnit, s.lengthUnit) : null;
              return (
                <Row key={f.key} style={{ justifyContent: 'space-between' }}>
                  <Text variant="caption" style={{ flex: 1.2 }}>
                    {f.label}
                  </Text>
                  <Text variant="caption" style={{ flex: 1, textAlign: 'right' }}>
                    {formatMeasurement(f.key, a[f.key], s.weightUnit, s.lengthUnit)}
                  </Text>
                  <Text variant="caption" style={{ flex: 1, textAlign: 'right' }}>
                    {formatMeasurement(f.key, b[f.key], s.weightUnit, s.lengthUnit)}
                  </Text>
                  <Text variant="caption" color={d == null ? colors.textSecondary : d > 0 ? colors.warning : colors.success} style={{ flex: 0.9, textAlign: 'right' }}>
                    {d == null ? '–' : `${d > 0 ? '+' : ''}${round(d, 1)}`}
                  </Text>
                </Row>
              );
            })}
          </Card>
        ) : null}

        {list.length === 0 ? (
          <Card>
            <EmptyState icon={Ruler} title="No measurements yet" message="Track body weight, body fat and circumferences over time." action="Add measurement" onAction={() => router.push('/body/edit')} />
          </Card>
        ) : (
          list.map((m) => {
            const isSel = compare.includes(m.id);
            const filled = MEASUREMENT_FIELDS.filter((f) => m[f.key] != null);
            return (
              <Card
                key={m.id}
                style={isSel ? { borderColor: colors.accent, borderWidth: 1 } : undefined}
                onPress={() => {
                  if (!comparing) return router.push({ pathname: '/body/edit', params: { id: m.id } });
                  setCompare((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id].slice(-2)));
                }}
                accessibilityLabel={`Measurement from ${format(m.measuredAt, 'PPP')}`}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">{format(m.measuredAt, 'EEE d MMM yyyy')}</Text>
                  {m.weightKg != null ? <Text variant="bodyStrong" color={colors.accent}>{formatMeasurement('weightKg', m.weightKg, s.weightUnit, s.lengthUnit)}</Text> : null}
                </Row>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {filled
                    .filter((f) => f.key !== 'weightKg')
                    .map((f) => (
                      <Text key={f.key} variant="caption" color={colors.textSecondary}>
                        {f.label}: {formatMeasurement(f.key, m[f.key], s.weightUnit, s.lengthUnit)}
                      </Text>
                    ))}
                </View>
              </Card>
            );
          })
        )}
        {list.length === limit ? <Button title="Load more" variant="secondary" onPress={() => setLimit((l) => l + PAGE)} /> : null}
      </Screen>
    </>
  );
}
