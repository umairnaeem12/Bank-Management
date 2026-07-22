'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';

/**
 * Runs the one-time client hydration of both stores and reports when it's done.
 *
 * The stores start empty on the server so that the SSR markup and the first
 * client render match; only after mount do we read LocalStorage and swap in
 * the real data. Components use the returned flag to show skeletons.
 */
export function useHydrated(): boolean {
  const bankHydrated = useBankStore((s) => s.hydrated);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // `hydrate` is idempotent — it no-ops if already run.
    useAuthStore.getState().hydrate();
    useBankStore.getState().hydrate();
    setMounted(true);
  }, []);

  return mounted && bankHydrated && authHydrated;
}
