'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, CheckCircle2, Download, Eye, XCircle } from 'lucide-react';
import type { Transaction, TransactionStatus, TransactionType } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDataTable } from '@/hooks/use-data-table';
import { useLookups } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { sortedRange } from '@/lib/algorithms/search';
import { exportCsv } from '@/lib/utils/export';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  fullName,
  maskAccountNumber,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge, TransactionStatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState, NoResultsState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { TransferForm } from '@/features/transactions/transfer-form';

type DateRange = 'all' | '7d' | '30d' | '90d';

const RANGE_DAYS: Record<Exclude<DateRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const transactions = useBankStore((s) => s.transactions);
  const accounts = useBankStore((s) => s.accounts);
  const customers = useBankStore((s) => s.customers);
  const settings = useBankStore((s) => s.settings);
  const transfer = useBankStore((s) => s.transfer);
  const setStatus = useBankStore((s) => s.setTransactionStatus);

  const { accountById, customerById, staffById } = useLookups();

  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [rangeFilter, setRangeFilter] = useState<DateRange>('all');
  const [transferOpen, setTransferOpen] = useState(false);
  const [viewing, setViewing] = useState<Transaction | null>(null);

  const canTransact = can(session?.role, 'transaction:write');

  useEffect(() => {
    if (searchParams.get('new') === 'transfer' && canTransact) {
      setTransferOpen(true);
      router.replace('/transactions');
    }
  }, [searchParams, canTransact, router]);

  // A `?ref=` param (from global search) opens that transaction's details.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref) return;

    const match = transactions.find((t) => t.reference === ref);
    if (match) {
      setViewing(match);
      router.replace('/transactions');
    }
  }, [searchParams, transactions, router]);

  /**
   * Date filtering uses a binary-search range over the already-sorted list
   * rather than scanning all 400+ rows on every keystroke. `transactions` is
   * kept newest-first, so it is reversed into ascending order for the lookup.
   */
  const dateFiltered = useMemo(() => {
    if (rangeFilter === 'all') return transactions;

    const cutoff = new Date(Date.now() - RANGE_DAYS[rangeFilter] * 86_400_000).toISOString();
    const ascending = [...transactions].reverse();
    const inRange = sortedRange(ascending, cutoff, null, (t) => t.createdAt);

    return inRange.reverse();
  }, [transactions, rangeFilter]);

  const filter = useCallback(
    (transaction: Transaction) =>
      (typeFilter === 'all' || transaction.type === typeFilter) &&
      (statusFilter === 'all' || transaction.status === statusFilter),
    [typeFilter, statusFilter],
  );

  const searchFields = useCallback(
    (transaction: Transaction) => {
      const source = accountById.get(transaction.fromAccountId);
      const destination = accountById.get(transaction.toAccountId);
      return [
        transaction.reference,
        transaction.description,
        transaction.type,
        source?.accountNumber ?? '',
        destination?.accountNumber ?? '',
      ];
    },
    [accountById],
  );

  const table = useDataTable<Transaction>({
    data: dateFiltered,
    searchFields,
    filter,
    initialSort: { key: 'createdAt', direction: 'desc' },
    pageSize: 15,
  });

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (rangeFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setRangeFilter('all');
    table.reset();
  };

  const handleTransfer = (
    fromId: string,
    toId: string,
    amountMinor: number,
    description: string,
  ) => {
    if (!session) return { ok: false as const, error: 'Not signed in.' };

    const result = transfer(fromId, toId, amountMinor, description, session.staffId);
    if (result.ok) {
      toast.success(
        'Transfer complete',
        `${formatCurrency(amountMinor, result.transaction.currency)} moved · ref ${result.transaction.reference}`,
      );
      setTransferOpen(false);
    }
    return result;
  };

  const handleStatusChange = (transaction: Transaction, next: TransactionStatus) => {
    if (!session) return;

    setStatus(transaction.id, next, session.staffId);
    toast.success(
      next === 'completed' ? 'Transaction settled' : 'Transaction updated',
      `${transaction.reference} is now ${next}.`,
    );
    setViewing(null);
  };

  const handleExport = () => {
    exportCsv('transactions', table.filteredAll, [
      { header: 'Reference', value: (t) => t.reference },
      { header: 'Date', value: (t) => formatDateTime(t.createdAt, 'iso') },
      { header: 'Type', value: (t) => titleCase(t.type) },
      { header: 'Description', value: (t) => t.description },
      {
        header: 'From',
        value: (t) => accountById.get(t.fromAccountId)?.accountNumber ?? '',
      },
      { header: 'To', value: (t) => accountById.get(t.toAccountId)?.accountNumber ?? '' },
      { header: 'Amount', value: (t) => (t.amount / 100).toFixed(2) },
      { header: 'Currency', value: (t) => t.currency },
      { header: 'Status', value: (t) => t.status },
    ]);
    toast.success('Export ready', `${table.filteredAll.length} transactions exported to CSV.`);
  };

  if (!hydrated) return <PageSkeleton />;

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

  const columns: Column<Transaction>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortable: true,
      cell: (transaction) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-primary-text tabular">
            {transaction.reference}
          </p>
          <p className="truncate text-xs text-muted-text">{transaction.description}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (transaction) => <TypeBadge type={transaction.type} />,
    },
    {
      key: 'accounts',
      header: 'Accounts',
      className: 'hidden xl:table-cell',
      cell: (transaction) => {
        const source = accountById.get(transaction.fromAccountId);
        const destination = accountById.get(transaction.toAccountId);

        return (
          <span className="text-xs text-secondary-text tabular">
            {source ? maskAccountNumber(source.accountNumber) : '—'}
            {' → '}
            {destination ? maskAccountNumber(destination.accountNumber) : '—'}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      className: 'hidden sm:table-cell',
      cell: (transaction) => (
        <span className="text-xs text-secondary-text tabular">
          {formatDateTime(transaction.createdAt, settings.dateFormat)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      cell: (transaction) => (
        <span
          className={`font-semibold tabular ${
            transaction.type === 'deposit'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-primary-text'
          }`}
        >
          {transaction.type === 'deposit' ? '+' : '−'}
          {formatCurrency(transaction.amount, transaction.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (transaction) => <TransactionStatusBadge status={transaction.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      cell: (transaction) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`View ${transaction.reference}`}
          onClick={(event) => {
            event.stopPropagation();
            setViewing(transaction);
          }}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Transactions"
        description={`${formatNumber(transactions.length)} transactions · ${formatNumber(pendingCount)} awaiting settlement`}
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
            {canTransact && (
              <Button
                size="sm"
                leftIcon={<ArrowLeftRight className="h-4 w-4" aria-hidden />}
                onClick={() => setTransferOpen(true)}
              >
                New transfer
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        query={table.query}
        onQueryChange={table.setQuery}
        placeholder="Search by reference, description or account…"
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: (value) => setTypeFilter(value as TransactionType | 'all'),
            options: [
              { value: 'all', label: 'All types' },
              { value: 'deposit', label: 'Deposits' },
              { value: 'withdrawal', label: 'Withdrawals' },
              { value: 'transfer', label: 'Transfers' },
              { value: 'fee', label: 'Fees' },
            ],
          },
          {
            label: 'Status',
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as TransactionStatus | 'all'),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'completed', label: 'Completed' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'reversed', label: 'Reversed' },
            ],
          },
          {
            label: 'Period',
            value: rangeFilter,
            onChange: (value) => setRangeFilter(value as DateRange),
            options: [
              { value: 'all', label: 'All time' },
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        page={table.page}
        rowKey={(transaction) => transaction.id}
        sortKey={table.sortKey as string | null}
        sortDirection={table.sortDirection}
        onSort={(key) => table.toggleSort(key as keyof Transaction)}
        onRowClick={(transaction) => setViewing(transaction)}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        dense={settings.density === 'compact'}
        emptyState={
          transactions.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-6 w-6" aria-hidden />}
              title="No transactions yet"
              description="Deposits, withdrawals and transfers will appear here."
            />
          ) : (
            <NoResultsState onClear={resetFilters} query={table.query} />
          )
        }
      />

      <TransferForm
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        customers={customers}
        onSubmit={handleTransfer}
      />

      {/* Detail dialog */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Transaction details"
        description={viewing?.reference}
        footer={
          viewing && canTransact && viewing.status === 'pending' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<XCircle className="h-4 w-4" aria-hidden />}
                onClick={() => handleStatusChange(viewing, 'failed')}
              >
                Mark failed
              </Button>
              <Button
                size="sm"
                leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                onClick={() => handleStatusChange(viewing, 'completed')}
              >
                Settle transaction
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
              Close
            </Button>
          )
        }
      >
        {viewing && (
          <dl className="space-y-3">
            <DetailRow label="Reference" value={viewing.reference} mono />
            <DetailRow label="Type" value={titleCase(viewing.type)} />
            <DetailRow
              label="Amount"
              value={formatCurrency(viewing.amount, viewing.currency)}
              mono
            />
            <DetailRow label="Description" value={viewing.description} />
            <DetailRow
              label="Date"
              value={formatDateTime(viewing.createdAt, settings.dateFormat)}
            />

            <div className="flex items-start justify-between gap-4 border-t border-border-subtle pt-3">
              <dt className="text-xs text-muted-text">Status</dt>
              <dd>
                <TransactionStatusBadge status={viewing.status} />
              </dd>
            </div>

            {viewing.fromAccountId && (
              <DetailRow
                label="From"
                value={accountLabel(viewing.fromAccountId)}
                mono
              />
            )}
            {viewing.toAccountId && (
              <DetailRow label="To" value={accountLabel(viewing.toAccountId)} mono />
            )}

            {viewing.balanceAfter !== null && (
              <DetailRow
                label="Balance after"
                value={formatCurrency(viewing.balanceAfter, viewing.currency)}
                mono
              />
            )}

            <DetailRow
              label="Processed by"
              value={
                staffById.get(viewing.createdByStaffId)
                  ? fullName(staffById.get(viewing.createdByStaffId)!)
                  : 'System'
              }
            />
          </dl>
        )}
      </Modal>
    </div>
  );

  /** Renders "•••• 1234 — Jane Doe" for an account id. */
  function accountLabel(accountId: string): string {
    const account = accountById.get(accountId);
    if (!account) return 'Unknown account';

    const owner = customerById.get(account.customerId);
    return `${maskAccountNumber(account.accountNumber)}${owner ? ` — ${fullName(owner)}` : ''}`;
  }
}

function TypeBadge({ type }: { type: TransactionType }) {
  const tone = {
    deposit: 'success',
    withdrawal: 'warning',
    transfer: 'info',
    fee: 'neutral',
  }[type] as 'success' | 'warning' | 'info' | 'neutral';

  return <Badge tone={tone}>{titleCase(type)}</Badge>;
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-text">{label}</dt>
      <dd
        className={`text-right text-xs font-medium text-primary-text ${mono ? 'tabular' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
