'use client';

import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { ToastViewport } from '@/components/ui/toast';

/**
 * Client-side root.
 *
 * Mounted once in the root layout. It kicks off store hydration and theme
 * application, then renders the tree plus the global toast stack. Children are
 * rendered immediately rather than gated on hydration — individual pages
 * decide their own skeleton behaviour via `useHydrated`.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  useHydrated();
  useTheme();

  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
