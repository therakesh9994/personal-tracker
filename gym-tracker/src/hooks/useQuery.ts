import { useCallback, useMemo, useState } from 'react';
import { useDataVersion } from '@/stores/dataStore';
import { errorMessage } from '@/utils/errors';

/**
 * Run a synchronous SQLite query and re-run it whenever data changes
 * (any service write bumps the data version) or when deps change.
 * Deps must be JSON-serialisable primitives (ids, filters, timestamps).
 *
 * `enabled: false` (e.g. a hidden tab) skips the query entirely and ignores data
 * changes; it runs again as soon as it is re-enabled.
 */
export function useQuery<T>(
  fn: () => T,
  deps: unknown[] = [],
  options: { enabled?: boolean } = {},
): { data: T | undefined; error: string | null; refresh: () => void } {
  const enabled = options.enabled ?? true;
  const version = useDataVersion((s) => s.version);
  const [tick, setTick] = useState(0);
  const depsKey = JSON.stringify(deps);
  // While disabled, the memo key ignores the data version so writes don't trigger work.
  const versionKey = enabled ? version : -1;
  const result = useMemo(() => {
    if (!enabled) return { data: undefined, error: null as string | null };
    try {
      return { data: fn(), error: null as string | null };
    } catch (e) {
      console.warn('Query failed', e);
      return { data: undefined, error: errorMessage(e) };
    }
    // `fn` is recreated every render; the query identity is (enabled, version, tick, deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, versionKey, tick, depsKey]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...result, refresh };
}
