'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Database,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  User,
} from 'lucide-react';
import type { Currency, ThemeMode } from '@/types';
import type { AppSettings } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/store/use-toast-store';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/auth/permissions';
import { formatDateTime, initialsFromName } from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Toggle } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" aria-hidden /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" aria-hidden /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" aria-hidden /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const staff = useBankStore((s) => s.staff);
  const settings = useBankStore((s) => s.settings);
  const updateSettings = useBankStore((s) => s.updateSettings);
  const resetDemoData = useBankStore((s) => s.resetDemoData);

  const { theme, setTheme } = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!hydrated) return <PageSkeleton />;

  const me = staff.find((s) => s.id === session?.staffId);

  const handleNotificationChange = (
    key: keyof AppSettings['notifications'],
    value: boolean,
  ) => {
    updateSettings({ notifications: { ...settings.notifications, [key]: value } });
    toast.success('Preferences saved', 'Your notification settings were updated.');
  };

  const handleReset = () => {
    resetDemoData();
    setConfirmReset(false);
    toast.success('Demo data reset', 'All records were regenerated from the seed dataset.');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage your profile, appearance, notifications and system preferences."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <User className="h-4 w-4 text-muted-text" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar
                  initials={initialsFromName(session?.name ?? '')}
                  color={me?.avatarColor ?? '#1e46e8'}
                  size="lg"
                  name={session?.name}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary-text">
                    {session?.name}
                  </p>
                  <p className="truncate text-xs text-muted-text">{session?.email}</p>
                  <div className="mt-1.5">
                    <Badge tone="brand">{session ? ROLE_LABELS[session.role] : ''}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={session?.name ?? ''}
                  readOnly
                  hint="Managed by your administrator."
                />
                <Input
                  label="Work email"
                  value={session?.email ?? ''}
                  readOnly
                  hint="Used to sign in."
                />
              </div>

              {me && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Branch" value={me.branch} readOnly />
                  <Input label="Employee code" value={me.employeeCode} readOnly />
                </div>
              )}

              <div className="rounded-lg bg-surface-sunken px-4 py-3">
                <p className="text-xs font-medium text-primary-text">Session</p>
                <p className="mt-1 text-xs text-muted-text">
                  Signed in {session ? formatDateTime(session.issuedAt) : '—'} · expires{' '}
                  {session ? formatDateTime(session.expiresAt) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <Palette className="h-4 w-4 text-muted-text" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium text-secondary-text">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={theme === option.value}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-xs font-medium transition-colors',
                        theme === option.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                          : 'border-border-strong text-secondary-text hover:bg-surface-hover',
                      )}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Table density"
                  value={settings.density}
                  onChange={(e) =>
                    updateSettings({ density: e.target.value as AppSettings['density'] })
                  }
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                  hint="Controls row height across all data tables."
                />
                <Select
                  label="Date format"
                  value={settings.dateFormat}
                  onChange={(e) =>
                    updateSettings({ dateFormat: e.target.value as AppSettings['dateFormat'] })
                  }
                  options={[
                    { value: 'us', label: 'Jul 22, 2026' },
                    { value: 'eu', label: '22 Jul 2026' },
                    { value: 'iso', label: '2026-07-22' },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-text" aria-hidden />
            </CardHeader>
            <CardContent className="divide-y divide-border-subtle py-0">
              <Toggle
                label="Transaction alerts"
                description="Notify me when a transaction fails or needs settlement approval."
                checked={settings.notifications.transactionAlerts}
                onChange={(v) => handleNotificationChange('transactionAlerts', v)}
              />
              <Toggle
                label="Request updates"
                description="Notify me when a service request assigned to me changes status."
                checked={settings.notifications.requestUpdates}
                onChange={(v) => handleNotificationChange('requestUpdates', v)}
              />
              <Toggle
                label="Weekly digest"
                description="A Monday summary of portfolio performance and open work."
                checked={settings.notifications.weeklyDigest}
                onChange={(v) => handleNotificationChange('weeklyDigest', v)}
              />
              <Toggle
                label="Product news"
                description="Occasional updates about new console features."
                checked={settings.notifications.productNews}
                onChange={(v) => handleNotificationChange('productNews', v)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Base currency"
                value={settings.baseCurrency}
                onChange={(e) => updateSettings({ baseCurrency: e.target.value as Currency })}
                options={[
                  { value: 'USD', label: 'USD — US Dollar' },
                  { value: 'EUR', label: 'EUR — Euro' },
                  { value: 'GBP', label: 'GBP — British Pound' },
                  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
                ]}
                hint="Used for aggregate figures on the dashboard and reports."
              />
              <p className="text-[11px] leading-relaxed text-muted-text">
                Individual accounts keep their own currency. Changing this only affects how
                totals are labelled — no conversion is applied in this demo.
              </p>
            </CardContent>
          </Card>

          {/* Access */}
          {session && (
            <Card>
              <CardHeader>
                <CardTitle>Your access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-relaxed text-secondary-text">
                  {ROLE_DESCRIPTIONS[session.role]}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {ROLE_PERMISSIONS[session.role].map((permission) => (
                    <li key={permission}>
                      <Badge tone={permission.endsWith(':read') ? 'neutral' : 'brand'}>
                        {permission}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Data management */}
          <Card>
            <CardHeader>
              <CardTitle>Demo data</CardTitle>
              <Database className="h-4 w-4 text-muted-text" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-text">
                All records live in your browser’s local storage. Resetting regenerates the
                original demo dataset and discards every change you have made.
              </p>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
                onClick={() => setConfirmReset(true)}
              >
                Reset demo data
              </Button>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  signOut();
                  router.replace('/login');
                }}
              >
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset demo data"
        message="This regenerates all customers, accounts, transactions, requests and staff from the seed dataset. Every change you have made will be lost. This cannot be undone."
        confirmLabel="Reset everything"
      />
    </div>
  );
}
