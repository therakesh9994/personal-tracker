import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Database, Download, Info, Ruler, Settings, User } from 'lucide-react-native';
import { Card, ListItem, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { getProfile } from '@/features/settings/service';
import { latestWeight } from '@/features/measurements/service';
import { listPhotos } from '@/features/photos/service';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatLength, formatWeight } from '@/utils/units';
import { format } from 'date-fns';

export default function ProfileTab() {
  const router = useRouter();
  const s = useSettings();
  const profile = useQuery(getProfile).data;
  const weight = useQuery(latestWeight).data;
  const photoCount = useQuery(() => listPhotos().length).data ?? 0;
  const chevron = <ChevronRight color={colors.textSecondary} size={18} />;
  return (
    <Screen edges={['top']}>
      <Text variant="display">{profile?.name || 'Profile'}</Text>
      <Row gap={spacing.sm}>
        <StatTile label="Height" value={formatLength(profile?.heightCm, s.lengthUnit)} />
        <StatTile label="Weight" value={weight ? formatWeight(weight.weightKg, s.weightUnit) : '–'} sub={weight ? format(weight.measuredAt, 'd MMM') : undefined} />
        <StatTile label="Photos" value={String(photoCount)} />
      </Row>

      <SectionHeader title="You" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListItem left={<User color={colors.accent} size={20} />} title="Personal information" subtitle="Name, height, birth date" onPress={() => router.push('/settings/profile')} right={chevron} />
        <ListItem left={<Ruler color={colors.accent} size={20} />} title="Body measurements" subtitle="Weight, body fat, circumferences" onPress={() => router.push('/body/measurements')} right={chevron} />
        <ListItem left={<Camera color={colors.accent} size={20} />} title="Progress photos" subtitle="Stored privately on this device" onPress={() => router.push('/photos')} right={chevron} />
      </Card>

      <SectionHeader title="App" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListItem left={<Settings color={colors.accent} size={20} />} title="Settings" subtitle={`Units: ${s.weightUnit} / ${s.lengthUnit} · Rest ${s.defaultRestSeconds}s`} onPress={() => router.push('/settings')} right={chevron} />
        <ListItem left={<Database color={colors.accent} size={20} />} title="Backup & restore" subtitle={s.autoBackupEnabled ? `Automatic backups: ${s.autoBackupFrequency.replace('_', ' ')}` : 'Automatic backups off'} onPress={() => router.push('/settings/backup')} right={chevron} />
        <ListItem left={<Download color={colors.accent} size={20} />} title="Export data" subtitle="ZIP, JSON or CSV" onPress={() => router.push('/settings/backup')} right={chevron} />
        <ListItem left={<Info color={colors.accent} size={20} />} title="About" subtitle="Privacy, limitations, version" onPress={() => router.push('/settings/about')} right={chevron} />
      </Card>
      <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        No account. No cloud. All data stays on this device.
      </Text>
    </Screen>
  );
}
