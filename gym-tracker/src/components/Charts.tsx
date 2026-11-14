/**
 * Chart components (Victory Native XL on Skia). Inputs are plain arrays computed
 * from SQLite; these components never fabricate data and show an empty state
 * when there is nothing to plot.
 */
import React, { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { matchFont } from '@shopify/react-native-skia';
import { Bar, CartesianChart, Line, Scatter } from 'victory-native';
import { BarChart3 } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { EmptyState, Text } from './ui';

export interface ChartPoint {
  label: string;
  value: number;
}

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
let cachedFont: ReturnType<typeof matchFont> | null = null;
function axisFont() {
  if (!cachedFont) {
    try {
      cachedFont = matchFont({ fontFamily, fontSize: 10, fontWeight: 'normal' });
    } catch {
      cachedFont = null;
    }
  }
  return cachedFont;
}

function useChartData(points: ChartPoint[]) {
  return useMemo(() => points.map((p, i) => ({ x: i, y: p.value })), [points]);
}

function labelFormatter(points: ChartPoint[]) {
  return (x: number) => {
    const i = Math.round(x);
    return i >= 0 && i < points.length && Number.isInteger(x) ? points[i].label : '';
  };
}

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${Math.round(v / 100_000) / 10}M`;
  if (a >= 10_000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${Math.round(v * 10) / 10}`;
};

interface BaseProps {
  points: ChartPoint[];
  height?: number;
  color?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  formatY?: (v: number) => string;
  accessibilityLabel?: string;
}

function Empty({ title, message, height }: { title?: string; message?: string; height: number }) {
  return (
    <View style={{ minHeight: height, justifyContent: 'center' }}>
      <EmptyState icon={BarChart3} title={title ?? 'No data yet'} message={message ?? 'Log some data to see this chart.'} />
    </View>
  );
}

function describe(points: ChartPoint[], formatY: (v: number) => string) {
  if (points.length === 0) return 'No data';
  const vals = points.map((p) => p.value);
  return `${points.length} points. Latest ${formatY(vals[vals.length - 1])}. Max ${formatY(Math.max(...vals))}. Min ${formatY(Math.min(...vals))}.`;
}

export function LineChart({ points, height = 200, color = colors.accent, emptyTitle, emptyMessage, formatY = compact, accessibilityLabel }: BaseProps) {
  const data = useChartData(points);
  const font = axisFont();
  if (points.length === 0) return <Empty title={emptyTitle} message={emptyMessage} height={height} />;
  const tickX = Math.min(points.length, 5);
  return (
    <View style={{ height }} accessible accessibilityLabel={`${accessibilityLabel ?? 'Line chart'}. ${describe(points, formatY)}`}>
      <CartesianChart
        data={data}
        xKey="x"
        yKeys={['y']}
        padding={{ left: 4, right: 8, top: 8, bottom: 4 }}
        domainPadding={{ left: 12, right: 12, top: 16, bottom: 8 }}
        axisOptions={{
          font,
          labelColor: colors.textSecondary,
          lineColor: { grid: { x: 'transparent', y: colors.border }, frame: 'transparent' },
          tickCount: { x: tickX, y: 4 },
          formatXLabel: labelFormatter(points),
          formatYLabel: (v) => formatY(Number(v)),
        }}
      >
        {({ points: p }) => (
          <>
            <Line points={p.y} color={color} strokeWidth={2.5} curveType="monotoneX" animate={{ type: 'timing', duration: 300 }} />
            {points.length <= 40 ? <Scatter points={p.y} radius={3} color={color} /> : null}
          </>
        )}
      </CartesianChart>
    </View>
  );
}

export function BarChart({ points, height = 200, color = colors.accent, emptyTitle, emptyMessage, formatY = compact, accessibilityLabel }: BaseProps) {
  const data = useChartData(points);
  const font = axisFont();
  const allZero = points.every((p) => p.value === 0);
  if (points.length === 0 || allZero) return <Empty title={emptyTitle} message={emptyMessage} height={height} />;
  return (
    <View style={{ height }} accessible accessibilityLabel={`${accessibilityLabel ?? 'Bar chart'}. ${describe(points, formatY)}`}>
      <CartesianChart
        data={data}
        xKey="x"
        yKeys={['y']}
        padding={{ left: 4, right: 4, top: 8, bottom: 4 }}
        domainPadding={{ left: 18, right: 18, top: 16 }}
        domain={{ y: [0] }}
        axisOptions={{
          font,
          labelColor: colors.textSecondary,
          lineColor: { grid: { x: 'transparent', y: colors.border }, frame: 'transparent' },
          tickCount: { x: Math.min(points.length, 7), y: 4 },
          formatXLabel: labelFormatter(points),
          formatYLabel: (v) => formatY(Number(v)),
        }}
      >
        {({ points: p, chartBounds }) => (
          <Bar points={p.y} chartBounds={chartBounds} color={color} roundedCorners={{ topLeft: 4, topRight: 4 }} innerPadding={0.35} />
        )}
      </CartesianChart>
    </View>
  );
}

/** Simple horizontal distribution bars (pure RN views; good for categories). */
export function DistributionBars({ items, formatValue = (v: number) => String(v) }: { items: { label: string; value: number }[]; formatValue?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <Empty height={120} title="No data yet" message="Complete workouts to see muscle distribution." />;
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((it, idx) => (
        <View key={it.label} style={{ gap: 4 }} accessible accessibilityLabel={`${it.label}: ${formatValue(it.value)}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption">{it.label}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {formatValue(it.value)}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ width: `${(it.value / max) * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.series[idx % colors.series.length] }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Compact day bars with labels underneath (Home "Weekly activity"). Empty days show a stub. */
export function DayBars({ items, color = colors.accent, height = 96, accessibilityLabel }: { items: { label: string; value: number }[]; color?: string; height?: number; accessibilityLabel?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <View style={{ gap: spacing.xs }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${accessibilityLabel ?? 'Daily values'}. ${items.map((i) => `${i.label}: ${i.value}`).join(', ')}`}
        style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}
      >
        {items.map((it, i) => {
          const ratio = max > 0 ? it.value / max : 0;
          const active = it.value > 0;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${active ? Math.max(8, ratio * 100) : 6}%`,
                backgroundColor: active ? color : colors.surface,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }} importantForAccessibility="no-hide-descendants">
        {items.map((it, i) => (
          <Text key={i} variant="label" color={colors.textSecondary} style={{ flex: 1, textAlign: 'center', textTransform: 'none' }}>
            {it.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
