import { Vibration } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

export function playTimerSound(): void {
  try {
    if (!player) player = createAudioPlayer(require('../../assets/sounds/timer-done.wav'));
    player.seekTo(0).catch(() => undefined);
    player.play();
  } catch (e) {
    console.warn('Could not play timer sound', e);
  }
}

export function vibrateTimer(): void {
  Vibration.vibrate([0, 300, 150, 300]);
}
