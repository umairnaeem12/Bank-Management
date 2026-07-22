'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark, LogOut, X } from 'lucide-react';
import { NAV_ITEMS, NAV_SECTIONS, isNavActive } from '@/lib/navigation';
import { can, ROLE_LABELS } from '@/lib/auth/permissions';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { initialsFromName } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface SidebarProps {
  /** Mobile drawer state; on desktop the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function Sidebar({ open, onClose, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const requests = useBankStore((s) => s.requests);
  const transactions = useBankStore((s) => s.transactions);

  // Counts shown as badges next to their nav items.
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const pendingTransactions = transactions.filter((t) => t.status === 'pending').length;

  const badgeFor = (href: string): number | null => {
    if (href === '/requests' && pendingRequests > 0) return pendingRequests;
    if (href === '/transactions' && pendingTransactions > 0) return pendingTransactions;
    return null;
  };

  const visibleItems = NAV_ITEMS.filter((item) => can(session?.role, item.permission));

  return (
    <>
      {/* Mobile scrim. Hidden from the a11y tree since the drawer handles focus. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-66 flex-col border-r border-border-subtle bg-surface',
          'transition-transform duration-300 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          'no-print',
        )}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-primary-text">NorthBank</span>
              <span className="text-[11px] text-muted-text">Management Console</span>
            </span>
          </Link>

          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden" aria-label="Close navigation">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_SECTIONS.map((section) => {
            const items = visibleItems.filter((item) => item.section === section);
            // A role with no items in a section shouldn't see its heading.
            if (items.length === 0) return null;

            return (
              <div key={section}>
                <p className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-muted-text uppercase">
                  {section}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    const badge = badgeFor(item.href);
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                              : 'text-secondary-text hover:bg-surface-hover hover:text-primary-text',
                          )}
                        >
                          {active && (
                            <span
                              className="absolute left-0 h-5 w-1 rounded-r-full bg-brand-600"
                              aria-hidden
                            />
                          )}
                          <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge !== null && (
                            <span
                              className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular"
                              aria-label={`${badge} pending`}
                            >
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Signed-in user */}
        {session && (
          <div className="shrink-0 border-t border-border-subtle p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar
                initials={initialsFromName(session.name)}
                size="sm"
                color="#1e46e8"
                name={session.name}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-primary-text">{session.name}</p>
                <p className="truncate text-[11px] text-muted-text">{ROLE_LABELS[session.role]}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
