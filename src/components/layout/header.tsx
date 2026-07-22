'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Sun,
  User,
  X,
} from 'lucide-react';
import type { NotificationLevel } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useTheme } from '@/hooks/use-theme';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { formatRelative, initialsFromName } from '@/lib/utils/format';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from './global-search';
import { cn } from '@/lib/utils/cn';

const LEVEL_DOTS: Record<NotificationLevel, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export interface HeaderProps {
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Header({ onMenuClick, onSignOut }: HeaderProps) {
  const session = useAuthStore((s) => s.session);
  const notifications = useBankStore((s) => s.notifications);
  const markAllRead = useBankStore((s) => s.markAllNotificationsRead);
  const markRead = useBankStore((s) => s.markNotificationRead);
  const dismiss = useBankStore((s) => s.dismissNotification);
  const { resolved, toggleTheme } = useTheme();

  const [panel, setPanel] = useState<'none' | 'notifications' | 'profile'>('none');
  const headerRef = useRef<HTMLElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  // Close whichever dropdown is open on outside click or Escape.
  useEffect(() => {
    if (panel === 'none') return;

    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setPanel('none');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel('none');
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panel]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/85 px-4 backdrop-blur-md sm:px-6 no-print"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Button>

      <div className="flex-1">
        <GlobalSearch />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
      >
        {resolved === 'dark' ? (
          <Sun className="h-4.5 w-4.5" aria-hidden />
        ) : (
          <Moon className="h-4.5 w-4.5" aria-hidden />
        )}
      </Button>

      {/* Notifications */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPanel((p) => (p === 'notifications' ? 'none' : 'notifications'))}
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          aria-expanded={panel === 'notifications'}
          className="relative"
        >
          <Bell className="h-4.5 w-4.5" aria-hidden />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[9px] font-bold text-white tabular">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>

        {panel === 'notifications' && (
          <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-subtle bg-surface card-shadow-lg animate-scale-in">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-semibold text-primary-text">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  <Check className="h-3 w-3" aria-hidden />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-text">
                  You’re all caught up.
                </p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'group relative flex gap-3 border-b border-border-subtle px-4 py-3 last:border-0 transition-colors',
                      !notification.read && 'bg-brand-50/50 dark:bg-brand-500/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        LEVEL_DOTS[notification.level],
                      )}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => markRead(notification.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-xs font-semibold text-primary-text">{notification.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-text">
                        {notification.body}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-text">
                        {formatRelative(notification.at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(notification.id)}
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 rounded p-1 text-muted-text opacity-0 transition-opacity hover:bg-surface-hover hover:text-primary-text focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      {session && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'profile' ? 'none' : 'profile'))}
            aria-expanded={panel === 'profile'}
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-hover"
          >
            <Avatar
              initials={initialsFromName(session.name)}
              size="sm"
              color="#1e46e8"
              name={session.name}
            />
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold text-primary-text">{session.name}</span>
              <span className="block text-[10px] text-muted-text">
                {ROLE_LABELS[session.role]}
              </span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-text sm:block" aria-hidden />
          </button>

          {panel === 'profile' && (
            <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-border-subtle bg-surface py-1 card-shadow-lg animate-scale-in">
              <div className="border-b border-border-subtle px-4 py-3">
                <p className="truncate text-sm font-semibold text-primary-text">{session.name}</p>
                <p className="truncate text-xs text-muted-text">{session.email}</p>
              </div>

              <Link
                href="/settings"
                onClick={() => setPanel('none')}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary-text transition-colors hover:bg-surface-hover hover:text-primary-text"
              >
                <User className="h-4 w-4" aria-hidden />
                Profile settings
              </Link>
              <Link
                href="/settings"
                onClick={() => setPanel('none')}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary-text transition-colors hover:bg-surface-hover hover:text-primary-text"
              >
                <SettingsIcon className="h-4 w-4" aria-hidden />
                Preferences
              </Link>

              <button
                type="button"
                onClick={() => {
                  setPanel('none');
                  onSignOut();
                }}
                className="flex w-full items-center gap-2.5 border-t border-border-subtle px-4 py-2.5 text-sm text-negative transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
