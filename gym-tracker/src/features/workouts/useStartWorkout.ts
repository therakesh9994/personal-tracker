import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage } from '@/utils/errors';
import { ActiveWorkoutExistsError, startWorkout, type StartWorkoutInput } from './service';

/** Start a workout and open it; if one is already running, offer to resume it. */
export function useStartWorkout() {
  const router = useRouter();
  return useCallback(
    (input: StartWorkoutInput = {}) => {
      try {
        startWorkout(input);
        router.push('/workout/active');
      } catch (e) {
        if (e instanceof ActiveWorkoutExistsError) {
          Alert.alert('Workout in progress', 'Finish or cancel your current workout before starting a new one.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Resume', onPress: () => router.push('/workout/active') },
          ]);
        } else {
          Alert.alert('Could not start workout', errorMessage(e));
        }
      }
    },
    [router],
  );
}
