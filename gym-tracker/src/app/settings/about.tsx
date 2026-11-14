import Constants from 'expo-constants';
import { Card, Screen, SectionHeader, Text } from '@/components/ui';
import { SCHEMA_VERSION } from '@/database/client';
import { colors } from '@/theme';

export default function AboutScreen() {
  return (
    <Screen>
      <Card>
        <Text variant="title">Gym Tracker</Text>
        <Text color={colors.textSecondary}>
          Version {Constants.expoConfig?.version ?? '1.0.0'} · database schema v{SCHEMA_VERSION}
        </Text>
        <Text>An offline-first training, body and nutrition tracker. Everything works without an internet connection.</Text>
      </Card>
      <SectionHeader title="Privacy" />
      <Card>
        <Text>• No account, no sign-in, no backend, no analytics or tracking.</Text>
        <Text>• All data is stored in a local SQLite database inside the app’s private storage.</Text>
        <Text>• Progress photos are copied into private app storage and never uploaded.</Text>
        <Text>• Data only leaves the device when you explicitly export or share a file.</Text>
      </Card>
      <SectionHeader title="Limitations" />
      <Card>
        <Text>• The database and backups are not encrypted. Anyone with access to an unlocked device or to an exported file can read them. Use your device lock screen and keep exported files private.</Text>
        <Text>• Automatic backups run at safe moments while the app is in use (launch, moving to background, after a workout). Android and iOS restrict background execution, so backups are not guaranteed on a schedule when the app is not opened.</Text>
        <Text>• Local backups live on this device. If the app is uninstalled or the device is lost, they are lost too — export a full backup regularly and keep it somewhere safe.</Text>
        <Text>• Estimated one-rep maxes use the Epley formula and are estimates, not tested maximums.</Text>
        <Text>• Nutrition values are entered by you. Goals are your own targets, not medical advice.</Text>
      </Card>
    </Screen>
  );
}
