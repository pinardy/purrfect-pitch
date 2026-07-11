import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * useState persisted to localStorage under `key`. `sanitize` validates the
 * stored value on load (clamp numbers, reject unknown variants) so stale or
 * hand-edited storage can't produce invalid state.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  sanitize: (stored: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : sanitize(JSON.parse(raw));
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode etc.) — value just won't persist
    }
  }, [key, value]);

  return [value, setValue];
}
