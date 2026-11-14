import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRestTimer } from '@/stores/restTimer';
import { getSettings } from '@/features/settings/service';
import { hasDb } from '@/database/client';
import { playTimerSound, vibrateTimer } from '@/services/alerts';

/**
 * Global watcher that fires the in-app alert when the rest timer ends.
 * Uses the absolute end timestamp, so it is correct after returning from background.
 */
export function RestTimerController() {
  const status = useRestTimer((s) => s.status);
  const endAt = useRestTimer((s) => s.endAt);
  useEffect(() => {
    if (status !== 'running' || endAt == null) return;
    const check = () => {
      const s = useRestTimer.getState();
      if (s.status !== 'running' || s.endAt == null || Date.now() < s.endAt) return;
      const wasForeground = AppState.currentState === 'active';
      s.markDone();
      if (!wasForeground) return; // the scheduled notification alerted the user
      try {
        const settings = hasDb() ? getSettings() : null;
        if (settings?.timerSound !== false) playTimerSound();
        if (settings?.timerVibration !== false) vibrateTimer();
      } catch {
        vibrateTimer();
      }
    };
    const id = setInterval(check, 250);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [status, endAt]);
  return null;
}
