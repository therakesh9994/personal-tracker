import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time, refreshed every `intervalMs` and when the app returns to the foreground. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs, enabled]);
  return now;
}
