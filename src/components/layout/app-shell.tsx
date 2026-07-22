'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/use-auth-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { toast } from '@/store/use-toast-store';
import { ConfirmDialog } from '@/components/ui/modal';
import { Sidebar } from './sidebar';
import { Header } from './header';

/**
 * Authenticated chrome: sidebar + header + content area, with the route guard.
 *
 * The guard runs on the client because the session lives in LocalStorage,
 * which the server can't read. Until hydration completes we render a neutral
 * splash rather than the app or the login page — showing either one and then
 * swapping would flash the wrong UI.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (hydrated && !session) router.replace('/login');
  }, [hydrated, session, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setSidebarOpen(false), [pathname]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-xs text-muted-text">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    signOut();
    setConfirmSignOut(false);
    toast.success('Signed out', 'You have been securely signed out of the console.');
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSignOut={() => setConfirmSignOut(true)}
      />

      {/* Offset matches the sidebar width on large screens. */}
      <div className="lg:pl-66">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onSignOut={() => setConfirmSignOut(true)}
        />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={handleSignOut}
        title="Sign out"
        message="You will need to sign in again to access the management console."
        confirmLabel="Sign out"
        tone="primary"
      />
    </div>
  );
}
