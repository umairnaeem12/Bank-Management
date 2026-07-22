'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Wallet,
} from 'lucide-react';
import type { Transaction } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore, type CustomerInput } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  useAccountTransactions,
  useCustomerAccounts,
  useCustomerRequests,
  useLookups,
} from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { sumBy } from '@/lib/algorithms/structures';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  fullName,
  initialsFromName,
  maskAccountNumber,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AccountStatusBadge,
  CustomerStatusBadge,
  KycBadge,
  RequestStatusBadge,
  TransactionStatusBadge,
} from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CustomerForm } from '@/features/customers/customer-form';

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 delivers route params as a promise.
  const { id } = use(params);

  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);

  const customers = useBankStore((s) => s.customers);
  const updateCustomer = useBankStore((s) => s.updateCustomer);
  const { staffById } = useLookups();

  const [editOpen, setEditOpen] = useState(false);

  const customer = customers.find((c) => c.id === id);
  const accounts = useCustomerAccounts(customer?.id);
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const transactions = useAccountTransactions(accountIds);
  const requests = useCustomerRequests(customer?.id);

  const canWrite = can(session?.role, 'customer:write');

  if (!hydrated) return <PageSkeleton />;

  if (!customer) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Customer not found"
          breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: 'Not found' }]}
        />
        <Card>
          <ErrorState
            title="We couldn’t find that customer"
            description="The record may have been deleted, or the link may be out of date."
            onRetry={() => router.push('/customers')}
          />
        </Card>
      </div>
    );
  }

  const totalBalance = sumBy(
    accounts.filter((a) => a.status !== 'closed'),
    (a) => a.balance,
  );
  // Balances are only meaningfully summable within one currency.
  const currencies = new Set(accounts.map((a) => a.currency));
  const isMixedCurrency = currencies.size > 1;
  const primaryCurrency = accounts[0]?.currency ?? 'USD';

  const handleSave = (values: CustomerInput) => {
    if (!session) return;
    updateCustomer(customer.id, values, session.staffId);
    toast.success('Customer updated', 'The record was saved successfully.');
    setEditOpen(false);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={fullName(customer)}
        breadcrumbs={[
          { label: 'Customers', href: '/customers' },
          { label: fullName(customer) },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              onClick={() => router.push('/customers')}
            >
              Back
            </Button>
            {canWrite && (
              <Button
                size="sm"
                leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center text-center">
            <Avatar
              initials={initialsFromName(fullName(customer))}
              color={customer.avatarColor}
              size="xl"
              name={fullName(customer)}
            />
            <h2 className="mt-4 text-lg font-semibold text-primary-text">{fullName(customer)}</h2>
            <p className="text-xs text-muted-text tabular">{customer.customerCode}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <CustomerStatusBadge status={customer.status} />
              <KycBadge status={customer.kycStatus} />
            </div>

            <dl className="mt-6 w-full space-y-3 text-left">
              <DetailRow
                icon={<Mail className="h-4 w-4" aria-hidden />}
                label="Email"
                value={customer.email}
              />
              <DetailRow
                icon={<Phone className="h-4 w-4" aria-hidden />}
                label="Phone"
                value={customer.phone}
              />
              <DetailRow
                icon={<MapPin className="h-4 w-4" aria-hidden />}
                label="Address"
                value={`${customer.addressLine}, ${customer.city}, ${customer.country}`}
              />
              <DetailRow
                icon={<CalendarDays className="h-4 w-4" aria-hidden />}
                label="Date of birth"
                value={formatDate(customer.dateOfBirth)}
              />
              <DetailRow
                icon={<Wallet className="h-4 w-4" aria-hidden />}
                label="Customer since"
                value={formatDate(customer.createdAt)}
              />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {/* Summary tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile
              label="Total balance"
              value={
                isMixedCurrency
                  ? 'Mixed currencies'
                  : formatCurrency(totalBalance, primaryCurrency)
              }
              hint={isMixedCurrency ? 'See accounts below' : undefined}
            />
            <SummaryTile label="Accounts" value={String(accounts.length)} />
            <SummaryTile label="Transactions" value={String(transactions.length)} />
          </div>

          {/* Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <Link
                href="/accounts"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                All accounts
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <EmptyState
                  icon={<CreditCard className="h-6 w-6" aria-hidden />}
                  title="No accounts"
                  description="This customer does not have any accounts yet."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <Link
                        href={`/accounts/${account.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                          <CreditCard className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-primary-text tabular">
                            {maskAccountNumber(account.accountNumber)}
                          </p>
                          <p className="truncate text-xs text-muted-text">
                            {titleCase(account.type)} · {account.currency}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-primary-text tabular">
                            {formatCurrency(account.balance, account.currency)}
                          </p>
                          <div className="mt-1 flex justify-end">
                            <AccountStatusBadge status={account.status} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Transaction history */}
          <Card>
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
              <span className="text-xs text-muted-text">
                Showing {Math.min(transactions.length, 8)} of {transactions.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <EmptyState title="No transactions" description="Activity will appear here." />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {transactions.slice(0, 8).map((transaction) => (
                    <li key={transaction.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-primary-text">
                          {transaction.description}
                        </p>
                        <p className="truncate text-xs text-muted-text tabular">
                          {transaction.reference} · {formatDateTime(transaction.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-semibold tabular ${signColor(transaction, accountIds)}`}
                        >
                          {signPrefix(transaction, accountIds)}
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

          {/* Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Service requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <EmptyState title="No requests" description="This customer has no open or past requests." />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {requests.map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/requests/${request.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-primary-text">{request.subject}</p>
                          <p className="truncate text-xs text-muted-text">
                            {request.ticket} · {formatDate(request.createdAt)}
                            {request.assignedStaffId &&
                              ` · ${staffById.get(request.assignedStaffId)?.firstName ?? 'Unassigned'}`}
                          </p>
                        </div>
                        <RequestStatusBadge status={request.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSave}
        customer={customer}
        existingEmails={customers.map((c) => c.email)}
      />
    </div>
  );
}

/** Money leaving this customer's accounts is negative from their perspective. */
function isOutgoing(transaction: Transaction, accountIds: string[]): boolean {
  return transaction.fromAccountId !== null && accountIds.includes(transaction.fromAccountId);
}

function signPrefix(transaction: Transaction, accountIds: string[]): string {
  return isOutgoing(transaction, accountIds) ? '−' : '+';
}

function signColor(transaction: Transaction, accountIds: string[]): string {
  return isOutgoing(transaction, accountIds)
    ? 'text-primary-text'
    : 'text-emerald-600 dark:text-emerald-400';
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-text" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-muted-text">{label}</dt>
        <dd className="break-words text-xs font-medium text-primary-text">{value}</dd>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4 card-shadow">
      <p className="text-xs text-muted-text">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-primary-text tabular">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-text">{hint}</p>}
    </div>
  );
}
