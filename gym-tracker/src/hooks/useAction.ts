import { useCallback } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from '@/utils/errors';

/** Wrap a user action so failures surface as a readable alert instead of a crash. */
export function useAction() {
  return useCallback(<T,>(fn: () => T | Promise<T>, title = 'Could not complete action'): Promise<T | undefined> => {
    return Promise.resolve()
      .then(fn)
      .catch((e) => {
        Alert.alert(title, errorMessage(e));
        return undefined;
      });
  }, []);
}

export function confirm(title: string, message: string, confirmText = 'Delete', destructive = true): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
