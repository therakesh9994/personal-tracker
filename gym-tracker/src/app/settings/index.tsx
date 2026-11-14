import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Chip, ListItem, Row, Screen, SectionHeader, Segmented, Text, Toggle } from '@/components/ui';
import { updateSettings } from '@/features/settings/service';
import { useSettings } from '@/hooks/useSettings';
import { useAction } from '@/hooks/useAction';
import { ensureNotificationPermission } from '@/services/notifications';
import { REST_PRESETS } from '@/stores/restTimer';
import { colors, spacing } from '@/theme';
import { formatDuration } from '@/utils/time';

export default function SettingsScreen() {
  const router = useRouter();
  const s = useSettings();
  const run = useAction();
  const set = (patch: Parameters<typeof updateSettings>[0]) => run(() => updateSettings(patch));
  return (
    <Screen>
      <SectionHeader title="Units" />
      <Card>
        <Text variant="bodyStrong">Weight</Text>
        <Segmented options={[{ key: 'kg', label: 'Kilograms (kg)' }, { key: 'lb', label: 'Pounds (lb)' }]} value={s.weightUnit} onChange={(v) => set({ weightUnit: v })} />
        <Text variant="bodyStrong">Length</Text>
        <Segmented options={[{ key: 'cm', label: 'Centimeters (cm)' }, { key: 'in', label: 'Inches (in)' }]} value={s.lengthUnit} onChange={(v) => set({ lengthUnit: v })} />
        <Text variant="caption" color={colors.textSecondary}>
          Data is stored in kg and cm and converted for display, so switching units never changes your history.
        </Text>
      </Card>

      <SectionHeader title="Rest timer" />
      <Card>
        <Text variant="bodyStrong">Default rest</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {REST_PRESETS.map((sec) => (
            <Chip key={sec} label={formatDuration(sec * 1000)} selected={s.defaultRestSeconds === sec} onPress={() => set({ defaultRestSeconds: sec })} />
          ))}
        </Row>
        <Toggle label="Auto-start after a set" description="Start the rest timer when you tick a set as completed." value={s.autoStartRestTimer} onChange={(v) => set({ autoStartRestTimer: v })} />
        <Toggle label="Sound" value={s.timerSound} onChange={(v) => set({ timerSound: v })} />
        <Toggle label="Vibration" value={s.timerVibration} onChange={(v) => set({ timerVibration: v })} />
        <ListItem
          title="Background alerts"
          subtitle="Allow notifications so the timer can alert you when the app is in the background."
          onPress={() =>
            run(async () => {
              const ok = await ensureNotificationPermission();
              if (!ok) throw new Error('Notifications are disabled. Enable them for Gym Tracker in your device settings.');
            })
          }
        />
      </Card>

      <SectionHeader title="Data" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListItem title="Backup & restore" subtitle="Automatic backups, export, import" onPress={() => router.push('/settings/backup')} />
        <ListItem title="Daily nutrition goals" onPress={() => router.push('/nutrition/goals')} />
        <ListItem title="Personal information" onPress={() => router.push('/settings/profile')} />
      </Card>
      <View />
    </Screen>
  );
}
