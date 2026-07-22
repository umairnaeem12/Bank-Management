'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Download,
  Pencil,
  Plus,
  XCircle,
} from 'lucide-react';
import type { Account, AccountStatus, AccountType } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore, type AccountInput } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDataTable } from '@/hooks/use-data-table';
import { useLookups } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { exportCsv } from '@/lib/utils/export';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  fullName,
  maskAccountNumber,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AccountStatusBadge, Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState, NoResultsState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { AccountForm, MoneyForm, type MoneyOperation } from '@/features/accounts/account-forms';

export default function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const accounts = useBankStore((s) => s.accounts);
  const customers = useBankStore((s) => s.customers);
  const settings = useBankStore((s) => s.settings);
  const addAccount = useBankStore((s) => s.addAccount);
  const updateAccount = useBankStore((s) => s.updateAccount);
  const closeAccount = useBankStore((s) => s.closeAccount);
  const deposit = useBankStore((s) => s.deposit);
  const withdraw = useBankStore((s) => s.withdraw);

  const { customerById } = useLookups();

  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [closing, setClosing] = useState<Account | null>(null);
  const [moneyTarget, setMoneyTarget] = useState<{ account: Account; op: MoneyOperation } | null>(
    null,
  );

  const canWrite = can(session?.role, 'account:write');
  const canTransact = can(session?.role, 'transaction:write');

  useEffect(() => {
    if (searchParams.get('new') === '1' && canWrite) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/accounts');
    }
  }, [searchParams, canWrite, router]);

  const filter = useCallback(
    (account: Account) =>
      (statusFilter === 'all' || account.status === statusFilter) &&
      (typeFilter === 'all' || account.type === typeFilter),
    [statusFilter, typeFilter],
  );

  // Owner name is searchable, so it must be resolved for each row.
  const searchFields = useCallback(
    (account: Account) => {
      const owner = customerById.get(account.customerId);
      return [
        account.accountNumber,
        account.type,
        account.currency,
        owner ? fullName(owner) : '',
        owner?.customerCode ?? '',
      ];
    },
    [customerById],
  );

  const table = useDataTable<Account>({
    data: accounts,
    searchFields,
    filter,
    initialSort: { key: 'balance', direction: 'desc' },
    pageSize: 10,
  });

  const totals = useMemo(() => {
    const active = accounts.filter((a) => a.status === 'active');
    return {
      active: active.length,
      frozen: accounts.filter((a) => a.status === 'frozen').length,
      dormant: accounts.filter((a) => a.status === 'dormant').length,
    };
  }, [accounts]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    table.reset();
  };

  const handleSubmit = (values: AccountInput) => {
    if (!session) return;

    if (editing) {
      updateAccount(editing.id, values, session.staffId);
      toast.success('Account updated', 'The account details were saved.');
    } else {
      const created = addAccount(values, session.staffId);
      toast.success(
        'Account opened',
        `Account ${maskAccountNumber(created.accountNumber)} is ready to use.`,
      );
    }

    setFormOpen(false);
    setEditing(null);
  };

  const handleClose = () => {
    if (!closing || !session) return;
    closeAccount(closing.id, session.staffId);
    toast.success('Account closed', `${maskAccountNumber(closing.accountNumber)} is now closed.`);
    setClosing(null);
  };

  const handleMoney = (amountMinor: number, description: string) => {
    if (!moneyTarget || !session) return { ok: false as const, error: 'No account selected.' };

    const { account, op } = moneyTarget;
    const result =
      op === 'deposit'
        ? deposit(account.id, amountMinor, description, session.staffId)
        : withdraw(account.id, amountMinor, description, session.staffId);

    if (result.ok) {
      toast.success(
        op === 'deposit' ? 'Deposit processed' : 'Withdrawal processed',
        `${formatCurrency(amountMinor, account.currency)} · ref ${result.transaction.reference}`,
      );
      setMoneyTarget(null);
    }

    return result;
  };

  const handleExport = () => {
    exportCsv('accounts', table.filteredAll, [
      { header: 'Account number', value: (a) => a.accountNumber },
      {
        header: 'Customer',
        value: (a) => {
          const owner = customerById.get(a.customerId);
          return owner ? fullName(owner) : 'Unknown';
        },
      },
      { header: 'Type', value: (a) => titleCase(a.type) },
      { header: 'Currency', value: (a) => a.currency },
      { header: 'Balance', value: (a) => (a.balance / 100).toFixed(2) },
      { header: 'Overdraft', value: (a) => (a.overdraftLimit / 100).toFixed(2) },
      { header: 'Interest rate', value: (a) => a.interestRate },
      { header: 'Status', value: (a) => a.status },
      { header: 'Opened', value: (a) => formatDate(a.openedAt, 'iso') },
    ]);
    toast.success('Export ready', `${table.filteredAll.length} accounts exported to CSV.`);
  };

  if (!hydrated) return <PageSkeleton />;

  const columns: Column<Account>[] = [
    {
      key: 'accountNumber',
      header: 'Account',
      sortable: true,
      cell: (account) => {
        const owner = customerById.get(account.customerId);
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-primary-text tabular">
              {maskAccountNumber(account.accountNumber)}
            </p>
            <p className="truncate text-xs text-muted-text">
              {owner ? fullName(owner) : 'Unknown customer'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (account) => <Badge tone="brand">{titleCase(account.type)}</Badge>,
    },
    {
      key: 'currency',
      header: 'Currency',
      sortable: true,
      className: 'hidden xl:table-cell',
      cell: (account) => <span className="text-xs tabular">{account.currency}</span>,
    },
    {
      key: 'interestRate',
      header: 'Rate',
      sortable: true,
      align: 'right',
      className: 'hidden xl:table-cell',
      cell: (account) => (
        <span className="text-xs tabular">{account.interestRate.toFixed(2)}%</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      align: 'right',
      cell: (account) => (
        <span
          className={`font-semibold tabular ${
            account.balance < 0 ? 'text-negative' : 'text-primary-text'
          }`}
        >
          {formatCurrency(account.balance, account.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (account) => <AccountStatusBadge status={account.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '140px',
      cell: (account) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Money can only move on an active account. */}
          {canTransact && account.status === 'active' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Deposit into ${maskAccountNumber(account.accountNumber)}`}
                title="Deposit"
                onClick={() => setMoneyTarget({ account, op: 'deposit' })}
                className="text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Withdraw from ${maskAccountNumber(account.accountNumber)}`}
                title="Withdraw"
                onClick={() => setMoneyTarget({ account, op: 'withdraw' })}
                className="text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
              >
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </>
          )}
          {canWrite && account.status !== 'closed' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${maskAccountNumber(account.accountNumber)}`}
                onClick={() => {
                  setEditing(account);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Close ${maskAccountNumber(account.accountNumber)}`}
                title="Close account"
                onClick={() => setClosing(account)}
                className="text-negative hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Accounts"
        description={`${formatNumber(totals.active)} active · ${formatNumber(totals.dormant)} dormant · ${formatNumber(totals.frozen)} frozen`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4" aria-hidden />}
              onClick={handleExport}
              disabled={table.filteredAll.length === 0}
            >
              Export
            </Button>
            {canWrite && (
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Open account
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        query={table.query}
        onQueryChange={table.setQuery}
        placeholder="Search by account number or customer…"
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as AccountStatus | 'all'),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'dormant', label: 'Dormant' },
              { value: 'frozen', label: 'Frozen' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          {
            label: 'Type',
            value: typeFilter,
            onChange: (value) => setTypeFilter(value as AccountType | 'all'),
            options: [
              { value: 'all', label: 'All types' },
              { value: 'savings', label: 'Savings' },
              { value: 'checking', label: 'Checking' },
              { value: 'fixed-deposit', label: 'Fixed Deposit' },
              { value: 'business', label: 'Business' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        page={table.page}
        rowKey={(account) => account.id}
        sortKey={table.sortKey as string | null}
        sortDirection={table.sortDirection}
        onSort={(key) => table.toggleSort(key as keyof Account)}
        onRowClick={(account) => router.push(`/accounts/${account.id}`)}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        dense={settings.density === 'compact'}
        emptyState={
          accounts.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-6 w-6" aria-hidden />}
              title="No accounts yet"
              description="Open an account for a customer to get started."
              action={
                canWrite
                  ? {
                      label: 'Open account',
                      onClick: () => {
                        setEditing(null);
                        setFormOpen(true);
                      },
                      icon: <Plus className="h-4 w-4" aria-hidden />,
                    }
                  : undefined
              }
            />
          ) : (
            <NoResultsState onClear={resetFilters} query={table.query} />
          )
        }
      />

      <AccountForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        customers={customers}
        account={editing}
      />

      <MoneyForm
        open={moneyTarget !== null}
        onClose={() => setMoneyTarget(null)}
        operation={moneyTarget?.op ?? 'deposit'}
        account={moneyTarget?.account ?? null}
        onSubmit={handleMoney}
      />

      <ConfirmDialog
        open={closing !== null}
        onClose={() => setClosing(null)}
        onConfirm={handleClose}
        title="Close account"
        message={
          closing
            ? `Close account ${maskAccountNumber(closing.accountNumber)}? Its balance of ${formatCurrency(closing.balance, closing.currency)} will be zeroed and no further transactions will be possible.`
            : ''
        }
        confirmLabel="Close account"
      />
    </div>
  );
}
