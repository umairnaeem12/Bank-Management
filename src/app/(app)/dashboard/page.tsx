'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ClipboardList,
  CreditCard,
  Landmark,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Transaction } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  useAccountTypeBreakdown,
  useDashboardStats,
  useMonthlySeries,
  useRecentTransactions,
  useRequestQueue,
  useTopAccounts,
} from '@/hooks/use-bank-data';
import { can } from '@/lib/auth/permissions';
import {
  formatCurrency,
  formatNumber,
  formatRelative,
  fullName,
  initialsFromName,
  maskAccountNumber,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { PriorityBadge, TransactionStatusBadge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import { DonutChart } from '@/components/charts/distribution-chart';

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);
  const settings = useBankStore((s) => s.settings);

  const stats = useDashboardStats();
  const monthly = useMonthlySeries(12);
  const accountTypes = useAccountTypeBreakdown();
  const topAccounts = useTopAccounts(5);
  const recent = useRecentTransactions(6);
  const queue = useRequestQueue();

  // Skeletons until LocalStorage has been read, so no figures flash as zero.
  if (!hydrated) return <PageSkeleton />;

  const currency = settings.baseCurrency;
  const firstName = session?.name.split(' ')[0] ?? 'there';

  const quickActions = [
    {
      label: 'New customer',
      icon: <UserPlus className="h-4 w-4" aria-hidden />,
      href: '/customers?new=1',
      permission: 'customer:write' as const,
    },
    {
      label: 'Open account',
      icon: <CreditCard className="h-4 w-4" aria-hidden />,
      href: '/accounts?new=1',
      permission: 'account:write' as const,
    },
    {
      label: 'New transfer',
      icon: <ArrowLeftRight className="h-4 w-4" aria-hidden />,
      href: '/transactions?new=transfer',
      permission: 'transaction:write' as const,
    },
    {
      label: 'Log request',
      icon: <ClipboardList className="h-4 w-4" aria-hidden />,
      href: '/requests?new=1',
      permission: 'request:write' as const,
    },
  ].filter((action) => can(session?.role, action.permission));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Here's what's happening across the bank today."
        actions={
          quickActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, i) => (
                <Button
                  key={action.href}
                  size="sm"
                  variant={i === 0 ? 'primary' : 'outline'}
                  leftIcon={action.icon}
                  onClick={() => router.push(action.href)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      />

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          value={formatNumber(stats.totalCustomers)}
          icon={<Users className="h-4.5 w-4.5" aria-hidden />}
          trend={stats.customerTrend}
          tone="brand"
        />
        <StatCard
          label="Total balance"
          value={formatCurrency(stats.totalBalance, currency, { compact: true })}
          icon={<Banknote className="h-4.5 w-4.5" aria-hidden />}
          tone="teal"
          hint={`Across ${formatNumber(stats.activeAccounts)} active accounts`}
        />
        <StatCard
          label="Transactions (30d)"
          value={formatNumber(stats.recentTransactions)}
          icon={<ArrowLeftRight className="h-4.5 w-4.5" aria-hidden />}
          trend={stats.transactionTrend}
          tone="purple"
        />
        <StatCard
          label="Pending items"
          value={formatNumber(stats.pendingTransactions + stats.pendingRequests)}
          icon={<ClipboardList className="h-4.5 w-4.5" aria-hidden />}
          tone="amber"
          hint={`${stats.pendingRequests} requests · ${stats.pendingTransactions} transactions`}
        />
      </div>

      {/* Secondary figures */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total accounts"
          value={formatNumber(stats.totalAccounts)}
          icon={<CreditCard className="h-4.5 w-4.5" aria-hidden />}
          tone="brand"
          hint={`${stats.activeAccounts} active`}
        />
        <StatCard
          label="Inflow (30d)"
          value={formatCurrency(stats.monthlyInflow, currency, { compact: true })}
          icon={<ArrowDownLeft className="h-4.5 w-4.5" aria-hidden />}
          tone="teal"
          hint="Settled deposits"
        />
        <StatCard
          label="Outflow (30d)"
          value={formatCurrency(stats.monthlyOutflow, currency, { compact: true })}
          icon={<ArrowUpRight className="h-4.5 w-4.5" aria-hidden />}
          tone="amber"
          hint="Withdrawals and fees"
        />
        <StatCard
          label="Staff"
          value={formatNumber(stats.staffCount)}
          icon={<UserCog className="h-4.5 w-4.5" aria-hidden />}
          tone="purple"
          hint={`${stats.activeStaff} currently active`}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Money movement</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">
                Settled deposits, withdrawals and transfers over the last 12 months
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <CashflowChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Accounts by type</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Excludes closed accounts</p>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={accountTypes}
              centerLabel="Accounts"
              formatValue={(v) => formatNumber(v)}
              height={200}
            />
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              View all
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <EmptyState
                icon={<ArrowLeftRight className="h-6 w-6" aria-hidden />}
                title="No transactions yet"
                description="Transactions will appear here as they are processed."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {recent.map(({ transaction, customer }) => (
                  <li key={transaction.id} className="flex items-center gap-3 px-5 py-3.5">
                    <TransactionIcon type={transaction.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary-text">
                        {transaction.description}
                      </p>
                      <p className="truncate text-xs text-muted-text">
                        {customer ? fullName(customer) : 'Unknown customer'} ·{' '}
                        {formatRelative(transaction.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular ${
                          transaction.type === 'deposit'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-primary-text'
                        }`}
                      >
                        {transaction.type === 'deposit' ? '+' : '−'}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <TransactionStatusBadge status={transaction.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request queue</CardTitle>
              <Link
                href="/requests"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" aria-hidden />}
                  title="Queue is clear"
                  description="No open requests need attention."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {queue.slice(0, 5).map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/requests/${request.id}`}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-primary-text">
                            {request.subject}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-text">
                            {request.ticket} · {formatRelative(request.createdAt)}
                          </p>
                        </div>
                        <PriorityBadge priority={request.priority} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top accounts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topAccounts.length === 0 ? (
                <EmptyState
                  icon={<Landmark className="h-6 w-6" aria-hidden />}
                  title="No accounts yet"
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {topAccounts.map(({ account, customer }) => (
                    <li key={account.id}>
                      <Link
                        href={`/accounts/${account.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                      >
                        <Avatar
                          initials={
                            customer ? initialsFromName(fullName(customer)) : '??'
                          }
                          color={customer?.avatarColor}
                          size="sm"
                          name={customer ? fullName(customer) : undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-primary-text">
                            {customer ? fullName(customer) : 'Unknown'}
                          </p>
                          <p className="truncate text-[11px] text-muted-text">
                            {maskAccountNumber(account.accountNumber)} · {titleCase(account.type)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-primary-text tabular">
                          {formatCurrency(account.balance, account.currency, { compact: true })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Small type-coded icon chip for the recent-transactions list. */
function TransactionIcon({ type }: { type: Transaction['type'] }) {
  const config = {
    deposit: {
      icon: <ArrowDownLeft className="h-4 w-4" aria-hidden />,
      className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    withdrawal: {
      icon: <ArrowUpRight className="h-4 w-4" aria-hidden />,
      className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    },
    transfer: {
      icon: <ArrowLeftRight className="h-4 w-4" aria-hidden />,
      className: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    },
    fee: {
      icon: <Banknote className="h-4 w-4" aria-hidden />,
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
    },
  }[type];

  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.className}`}
      aria-hidden
    >
      {config.icon}
    </span>
  );
}
