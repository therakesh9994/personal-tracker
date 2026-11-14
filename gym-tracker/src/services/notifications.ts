/**
 * Local notifications for the rest timer (no push, no network).
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

export const REST_CHANNEL_ID = 'rest-timer';
const REST_KIND = 'rest-timer';

let configured = false;

export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      // In the foreground the app plays its own alert; avoid a duplicate banner/sound.
      const isRest = n.request.content.data?.kind === REST_KIND;
      const foreground = AppState.currentState === 'active';
      const show = !(isRest && foreground);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest timer',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
      sound: 'default',
    }).catch(() => undefined);
  }
}

/** Returns true when notifications may be shown. Never throws. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function scheduleRestDone(seconds: number): Promise<string | null> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest complete', body: 'Time for your next set.', sound: 'default', data: { kind: REST_KIND } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: REST_CHANNEL_ID },
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}
