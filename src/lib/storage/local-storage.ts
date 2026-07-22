/**
 * Typed LocalStorage wrapper.
 *
 * Every access is guarded because this code also runs during SSR, where
 * `window` does not exist, and because a browser in private mode can throw
 * `QuotaExceededError` on write. Callers get a safe fallback instead of a crash.
 */

export const STORAGE_KEYS = {
  customers: 'bank:customers',
  accounts: 'bank:accounts',
  transactions: 'bank:transactions',
  requests: 'bank:requests',
  staff: 'bank:staff',
  activity: 'bank:activity',
  notifications: 'bank:notifications',
  settings: 'bank:settings',
  session: 'bank:session',
  seedVersion: 'bank:seed-version',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStorage<T>(key: StorageKey, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON or blocked storage — fall back rather than break the app.
    return fallback;
  }
}

export function writeStorage<T>(key: StorageKey, value: T): boolean {
  if (!isBrowser()) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: StorageKey): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

/** Wipes all app-owned keys. Used by "Reset demo data" in Settings. */
export function clearAppStorage(): void {
  if (!isBrowser()) return;
  for (const key of Object.values(STORAGE_KEYS)) {
    removeStorage(key);
  }
}
