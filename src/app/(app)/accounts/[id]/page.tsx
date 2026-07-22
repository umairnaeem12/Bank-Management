'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Download, Percent, Wallet } from 'lucide-react';
import type { Transaction } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useAccountTransactions, useLookups } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { exportCsv, exportPdf } from '@/lib/utils/export';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  fullName,
  maskAccountNumber,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountStatusBadge, Badge, TransactionStatusBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { MoneyForm, type MoneyOperation } from '@/features/accounts/account-forms';

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);

  const accounts = useBankStore((s) => s.accounts);
  const deposit = useBankStore((s) => s.deposit);
  const withdraw = useBankStore((s) => s.withdraw);
  const { customerById } = useLookups();

  const [moneyOp, setMoneyOp] = useState<MoneyOperation | null>(null);

  const account = accounts.find((a) => a.id === id);
  const accountIds = useMemo(() => (account ? [account.id] : []), [account]);
  const transactions = useAccountTransactions(accountIds);

  const canTransact = can(session?.role, 'transaction:write');

  if (!hydrated) return <PageSkeleton />;

  if (!account) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Account not found"
          breadcrumbs={[{ label: 'Accounts', href: '/accounts' }, { label: 'Not found' }]}
        />
        <Card>
          <ErrorState
            title="We couldn’t find that account"
            description="The account may have been removed, or the link may be out of date."
            onRetry={() => router.push('/accounts')}
          />
        </Card>
      </div>
    );
  }

  const owner = customerById.get(account.customerId);

  const handleMoney = (amountMinor: number, description: string) => {
    if (!session || !moneyOp) return { ok: false as const, error: 'No operation selected.' };

    const result =
      moneyOp === 'deposit'
        ? deposit(account.id, amountMinor, description, session.staffId)
        : withdraw(account.id, amountMinor, description, session.staffId);

    if (result.ok) {
      toast.success(
        moneyOp === 'deposit' ? 'Deposit processed' : 'Withdrawal processed',
        `${formatCurrency(amountMinor, account.currency)} · ref ${result.transaction.reference}`,
      );
      setMoneyOp(null);
    }

    return result;
  };

  const statementColumns = [
    { header: 'Date', value: (t: Transaction) => formatDateTime(t.createdAt, 'iso') },
    { header: 'Reference', value: (t: Transaction) => t.reference },
    { header: 'Description', value: (t: Transaction) => t.description },
    { header: 'Type', value: (t: Transaction) => titleCase(t.type) },
    {
      header: `Amount (${account.currency})`,
      value: (t: Transaction) =>
        `${isDebit(t, account.id) ? '-' : '+'}${(t.amount / 100).toFixed(2)}`,
    },
    { header: 'Status', value: (t: Transaction) => t.status },
    {
      header: 'Balance after',
      value: (t: Transaction) => (t.balanceAfter === null ? '' : (t.balanceAfter / 100).toFixed(2)),
    },
  ];

  const handleExportCsv = () => {
    exportCsv(`statement-${account.accountNumber}`, transactions, statementColumns);
    toast.success('Statement exported', `${transactions.length} transactions exported to CSV.`);
  };

  const handleExportPdf = () => {
    const opened = exportPdf(
      `Account statement — ${maskAccountNumber(account.accountNumber)}`,
      transactions,
      statementColumns,
      `${owner ? fullName(owner) : 'Unknown holder'} · ${titleCase(account.type)} · ${account.currency}`,
    );

    if (opened) {
      toast.info('Print view opened', 'Choose “Save as PDF” in the print dialog.');
    } else {
      toast.error('Popup blocked', 'Allow popups for this site to export a PDF statement.');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={maskAccountNumber(account.accountNumber)}
        description={owner ? `Held by ${fullName(owner)}` : 'Account holder not found'}
        breadcrumbs={[
          { label: 'Accounts', href: '/accounts' },
          { label: maskAccountNumber(account.accountNumber) },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              onClick={() => router.push('/accounts')}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4" aria-hidden />}
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={transactions.length === 0}
            >
              PDF
            </Button>
            {canTransact && account.status === 'active' && (
              <>
                <Button
                  size="sm"
                  leftIcon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
                  onClick={() => setMoneyOp('deposit')}
                >
                  Deposit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
                  onClick={() => setMoneyOp('withdraw')}
                >
                  Withdraw
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Balance summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-text">Current balance</p>
              <Wallet className="h-4 w-4 text-muted-text" aria-hidden />
            </div>
            <p
              className={`mt-2 text-2xl font-semibold tabular ${
                account.balance < 0 ? 'text-negative' : 'text-primary-text'
              }`}
            >
              {formatCurrency(account.balance, account.currency)}
            </p>
            <div className="mt-2">
              <AccountStatusBadge status={account.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs text-muted-text">Available</p>
            <p className="mt-2 text-2xl font-semibold text-primary-text tabular">
              {formatCurrency(account.balance + account.overdraftLimit, account.currency)}
            </p>
            <p className="mt-2 text-xs text-muted-text">
              Includes {formatCurrency(account.overdraftLimit, account.currency)} overdraft
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-text">Interest rate</p>
              <Percent className="h-4 w-4 text-muted-text" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-semibold text-primary-text tabular">
              {account.interestRate.toFixed(2)}%
            </p>
            <p className="mt-2 text-xs text-muted-text">Annual, paid monthly</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs text-muted-text">Account details</p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Type</dt>
                <dd>
                  <Badge tone="brand">{titleCase(account.type)}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Currency</dt>
                <dd className="font-medium text-primary-text tabular">{account.currency}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Opened</dt>
                <dd className="font-medium text-primary-text">{formatDate(account.openedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Holder</dt>
                <dd className="truncate font-medium text-primary-text">
                  {owner ? (
                    <Link
                      href={`/customers/${owner.id}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {fullName(owner)}
                    </Link>
                  ) : (
                    'Unknown'
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Statement */}
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Statement</CardTitle>
            <p className="mt-0.5 text-xs text-muted-text">
              {transactions.length} transaction{transactions.length === 1 ? '' : 's'}, newest first
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <EmptyState
              title="No transactions"
              description="Deposits, withdrawals and transfers will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-sunken">
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase">
                      Date
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase md:table-cell">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase">
                      Description
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-secondary-text uppercase">
                      Amount
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold tracking-wide text-secondary-text uppercase lg:table-cell">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 50).map((transaction) => {
                    const debit = isDebit(transaction, account.id);

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover"
                      >
                        <td className="px-4 py-3 text-xs text-secondary-text tabular">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-text tabular md:table-cell">
                          {transaction.reference}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-primary-text">{transaction.description}</p>
                          <p className="text-xs text-muted-text">{titleCase(transaction.type)}</p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <TransactionStatusBadge status={transaction.status} />
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold tabular ${
                            debit ? 'text-primary-text' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {debit ? '−' : '+'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-xs text-secondary-text tabular lg:table-cell">
                          {transaction.balanceAfter === null
                            ? '—'
                            : formatCurrency(transaction.balanceAfter, account.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {transactions.length > 50 && (
                <p className="border-t border-border-subtle px-4 py-3 text-center text-xs text-muted-text">
                  Showing the 50 most recent transactions. Export for the full statement.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <MoneyForm
        open={moneyOp !== null}
        onClose={() => setMoneyOp(null)}
        operation={moneyOp ?? 'deposit'}
        account={account}
        onSubmit={handleMoney}
      />
    </div>
  );
}

/** True when the transaction takes money out of this account. */
function isDebit(transaction: Transaction, accountId: string): boolean {
  return transaction.fromAccountId === accountId;
}
