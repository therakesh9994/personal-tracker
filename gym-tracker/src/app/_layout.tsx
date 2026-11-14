import { useCallback, useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { AppState, View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { defaultDatabaseDirectory } from 'expo-sqlite';
import { AlertTriangle } from 'lucide-react-native';
import { DATABASE_NAME, initDatabase } from '@/database/native';
import { configureNotifications } from '@/services/notifications';
import { runAutoBackupIfDue } from '@/features/backup/service';
import { RestTimerController } from '@/components/RestTimerController';
import { Button, Text, flushPendingInputs } from '@/components/ui';
import { colors, enableSystemFontFallback, font, spacing } from '@/theme';
import { errorMessage } from '@/utils/errors';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  // Fonts are bundled (offline). If loading fails, the app falls back to system fonts.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  if (fontError) {
    // Must happen before any text renders (content is gated on fontsReady below).
    enableSystemFontFallback();
  }

  const start = useCallback(() => {
    initDatabase()
      .then(() => setBoot({ status: 'ready' }))
      .catch((e) => {
        console.error('Database initialisation failed', e);
        setBoot({ status: 'error', message: errorMessage(e) });
      });
  }, []);

  useEffect(() => {
    configureNotifications();
    start();
  }, [start]);

  useEffect(() => {
    if (boot.status !== 'loading' && fontsReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [boot.status, fontsReady]);

  useEffect(() => {
    if (boot.status !== 'ready') return;
    // Safe checkpoints for best-effort automatic backups.
    const t = setTimeout(() => void runAutoBackupIfDue('launch'), 4000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') flushPendingInputs();
      if (s === 'background') void runAutoBackupIfDue('background');
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [boot.status]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {boot.status === 'error' ? (
          <DatabaseError
            message={boot.message}
            onRetry={() => {
              setBoot({ status: 'loading' });
              start();
            }}
          />
        ) : boot.status === 'loading' || !fontsReady ? (
          <View style={{ flex: 1, backgroundColor: colors.background }} />
        ) : (
          <>
            <RestTimerController />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { color: colors.text, ...font('display') },
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="workout/active" options={{ title: 'Workout', gestureEnabled: false }} />
              <Stack.Screen name="workout/history" options={{ title: 'History' }} />
              <Stack.Screen name="workout/[id]" options={{ title: 'Workout details' }} />
              <Stack.Screen name="exercise/index" options={{ title: 'Exercise library' }} />
              <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
              <Stack.Screen name="exercise/edit" options={{ title: 'Custom exercise', presentation: 'modal' }} />
              <Stack.Screen name="plans/index" options={{ title: 'Workout plans' }} />
              <Stack.Screen name="plans/[id]" options={{ title: 'Edit plan' }} />
              <Stack.Screen name="body/measurements" options={{ title: 'Body measurements' }} />
              <Stack.Screen name="body/edit" options={{ title: 'Measurement', presentation: 'modal' }} />
              <Stack.Screen name="photos/index" options={{ title: 'Progress photos' }} />
              <Stack.Screen name="photos/[id]" options={{ title: 'Photo' }} />
              <Stack.Screen name="photos/compare" options={{ title: 'Compare photos' }} />
              <Stack.Screen name="nutrition/foods" options={{ title: 'Foods' }} />
              <Stack.Screen name="nutrition/food-edit" options={{ title: 'Food', presentation: 'modal' }} />
              <Stack.Screen name="nutrition/log" options={{ title: 'Log food', presentation: 'modal' }} />
              <Stack.Screen name="nutrition/goals" options={{ title: 'Daily goals' }} />
              <Stack.Screen name="nutrition/water" options={{ title: 'Water history' }} />
              <Stack.Screen name="records/index" options={{ title: 'Personal records' }} />
              <Stack.Screen name="reports/monthly" options={{ title: 'Monthly report' }} />
              <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
              <Stack.Screen name="settings/profile" options={{ title: 'Personal information' }} />
              <Stack.Screen name="settings/backup" options={{ title: 'Backup & restore' }} />
              <Stack.Screen name="settings/about" options={{ title: 'About' }} />
            </Stack>
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function DatabaseError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const exportRaw = async () => {
    try {
      const f = new File(defaultDatabaseDirectory, DATABASE_NAME);
      if (f.exists && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(f.uri, { dialogTitle: 'Save database file' });
    } catch {
      // nothing else we can do here
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xxl, justifyContent: 'center', gap: spacing.lg }}>
      <AlertTriangle color={colors.error} size={40} />
      <Text variant="title">The database could not be opened</Text>
      <Text color={colors.textSecondary}>
        Your data has not been deleted. A database upgrade failed and was rolled back. You can retry, or save a copy of the raw database file for safekeeping.
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        Details: {message}
      </Text>
      <Button title="Retry" onPress={onRetry} />
      <Button title="Save database file" variant="secondary" onPress={exportRaw} />
    </View>
  );
}
