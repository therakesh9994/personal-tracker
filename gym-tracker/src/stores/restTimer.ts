/**
 * Rest timer state. Timing is based on absolute timestamps (endAt), so it stays
 * accurate when JS timers are throttled in the background. A local notification
 * is scheduled for the end time so the user is alerted even when the app is
 * backgrounded.
 */
import { create } from 'zustand';
import { cancelNotification, scheduleRestDone } from '@/services/notifications';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

interface RestTimerState {
  status: TimerStatus;
  durationMs: number;
  endAt: number | null;
  remainingWhenPaused: number;
  notificationId: string | null;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  adjust: (seconds: number) => void;
  markDone: () => void;
}

export function remainingMs(s: Pick<RestTimerState, 'status' | 'endAt' | 'remainingWhenPaused'>, nowMs = Date.now()): number {
  if (s.status === 'running' && s.endAt != null) return Math.max(0, s.endAt - nowMs);
  if (s.status === 'paused') return s.remainingWhenPaused;
  return 0;
}

export const useRestTimer = create<RestTimerState>((set, get) => {
  const reschedule = (ms: number) => {
    void cancelNotification(get().notificationId);
    set({ notificationId: null });
    const endAt = get().endAt;
    void scheduleRestDone(ms / 1000).then((id) => {
      // Only keep the id if this timer run is still the active one.
      if (get().status === 'running' && get().endAt === endAt) set({ notificationId: id });
      else void cancelNotification(id);
    });
  };
  return {
    status: 'idle',
    durationMs: 0,
    endAt: null,
    remainingWhenPaused: 0,
    notificationId: null,
    start: (seconds) => {
      const ms = Math.max(1, Math.round(seconds)) * 1000;
      set({ status: 'running', durationMs: ms, endAt: Date.now() + ms, remainingWhenPaused: 0 });
      reschedule(ms);
    },
    pause: () => {
      const s = get();
      if (s.status !== 'running') return;
      void cancelNotification(s.notificationId);
      set({ status: 'paused', remainingWhenPaused: remainingMs(s), endAt: null, notificationId: null });
    },
    resume: () => {
      const s = get();
      if (s.status !== 'paused') return;
      set({ status: 'running', endAt: Date.now() + s.remainingWhenPaused });
      reschedule(s.remainingWhenPaused);
    },
    reset: () => {
      void cancelNotification(get().notificationId);
      set({ status: 'idle', endAt: null, remainingWhenPaused: 0, notificationId: null, durationMs: 0 });
    },
    adjust: (seconds) => {
      const s = get();
      if (s.status === 'running' && s.endAt != null) {
        const left = Math.max(1000, s.endAt - Date.now() + seconds * 1000);
        set({ endAt: Date.now() + left, durationMs: Math.max(s.durationMs + seconds * 1000, left) });
        reschedule(left);
      } else if (s.status === 'paused') {
        set({ remainingWhenPaused: Math.max(1000, s.remainingWhenPaused + seconds * 1000) });
      }
    },
    markDone: () => set({ status: 'done', endAt: null, notificationId: null }),
  };
});

export const REST_PRESETS = [30, 60, 90, 120, 180];
