import { randomUUID } from 'expo-crypto';

/** Stable, globally unique identifier for every record. */
export function newId(): string {
  return randomUUID();
}
