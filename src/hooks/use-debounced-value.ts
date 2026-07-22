'use client';

import { useEffect, useState } from 'react';

/**
 * Delays propagating a rapidly-changing value.
 *
 * Search inputs re-render large filtered tables on every keystroke; debouncing
 * the query means the expensive ranking pass runs once the user pauses rather
 * than once per character.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    // Clearing on every change is what collapses a burst of keystrokes into
    // a single update.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
