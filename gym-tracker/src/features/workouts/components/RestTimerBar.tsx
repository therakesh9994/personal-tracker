import { useState } from 'react';
import { View } from 'react-native';
import { Timer, X } from 'lucide-react-native';
import { OptionSheet } from '@/components/OptionSheet';
import { Button, IconButton, NumberInput, Row, Text } from '@/components/ui';
import { REST_PRESETS, remainingMs, useRestTimer } from '@/stores/restTimer';
import { useNow } from '@/hooks/useNow';
import { colors, radius, spacing } from '@/theme';
import { formatDuration } from '@/utils/time';

export function RestTimerBar({ suggestedSeconds }: { suggestedSeconds: number }) {
  const t = useRestTimer();
  const now = useNow(250, t.status === 'running');
  const [sheet, setSheet] = useState(false);
  const [custom, setCustom] = useState<number | null>(null);
  const left = remainingMs(t, now);
  const progress = t.durationMs > 0 ? left / t.durationMs : 0;
  const counting = t.status === 'running' || t.status === 'paused';
  const label = t.status === 'done' ? 'Rest complete' : t.status === 'paused' ? 'Rest paused' : t.status === 'running' ? 'Resting' : 'Rest timer';

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.status === 'done' ? colors.success : counting ? colors.accentMuted : colors.border,
        padding: spacing.md + 2,
        gap: spacing.md - 2,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Timer color={t.status === 'done' ? colors.success : colors.accent} size={18} />
          <Text variant="label" color={colors.textSecondary}>
            {label}
          </Text>
        </Row>
        {counting ? (
          <Text variant="display" color={t.status === 'paused' ? colors.textSecondary : colors.accent} style={{ fontSize: 28, fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite">
            {formatDuration(left)}
          </Text>
        ) : t.status === 'done' ? (
          <IconButton icon={X} label="Dismiss rest timer" size={34} onPress={t.reset} />
        ) : null}
      </Row>

      {counting ? (
        <>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Rest remaining"
            accessibilityValue={{ min: 0, max: Math.round(t.durationMs / 1000), now: Math.round(left / 1000) }}
            style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}
          >
            <View style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="−15s" variant="secondary" style={{ flex: 1, paddingHorizontal: 0 }} onPress={() => t.adjust(-15)} accessibilityLabel="Subtract 15 seconds" />
            <Button title="+15s" variant="secondary" style={{ flex: 1, paddingHorizontal: 0 }} onPress={() => t.adjust(15)} accessibilityLabel="Add 15 seconds" />
            {t.status === 'running' ? (
              <Button title="Pause" variant="secondary" style={{ flex: 1, paddingHorizontal: 0 }} onPress={t.pause} accessibilityLabel="Pause rest timer" />
            ) : (
              <Button title="Resume" style={{ flex: 1, paddingHorizontal: 0 }} onPress={t.resume} accessibilityLabel="Resume rest timer" />
            )}
            <Button title="Skip" variant="secondary" style={{ flex: 1, paddingHorizontal: 0 }} onPress={t.reset} accessibilityLabel="Skip rest" />
          </View>
          <Button title="Change rest duration" variant="ghost" size="sm" onPress={() => setSheet(true)} />
        </>
      ) : (
        <Row>
          <Button title={`Start ${formatDuration(suggestedSeconds * 1000)}`} style={{ flex: 1 }} onPress={() => t.start(suggestedSeconds)} />
          <Button title="Presets" variant="secondary" style={{ flex: 1 }} onPress={() => setSheet(true)} />
        </Row>
      )}

      <OptionSheet
        visible={sheet}
        title="Rest duration"
        message={counting ? 'Choosing a duration restarts the rest timer from that length.' : undefined}
        onClose={() => setSheet(false)}
        options={REST_PRESETS.map((s) => ({ key: String(s), label: formatDuration(s * 1000), selected: s === suggestedSeconds }))}
        onSelect={(k) => t.start(Number(k))}
      >
        <Row>
          <NumberInput value={custom} onCommit={setCustom} placeholder="Custom seconds" decimals={false} style={{ flex: 1 }} accessibilityLabel="Custom rest seconds" />
          <Button
            title="Start"
            size="sm"
            disabled={!custom || custom < 5 || custom > 1800}
            onPress={() => {
              if (custom) t.start(custom);
              setSheet(false);
            }}
          />
        </Row>
      </OptionSheet>
    </View>
  );
}
