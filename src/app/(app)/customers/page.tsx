'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import type { Customer, CustomerStatus, KycStatus } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore, type CustomerInput } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDataTable } from '@/hooks/use-data-table';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { exportCsv } from '@/lib/utils/export';
import { formatDate, formatNumber, fullName, initialsFromName } from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { CustomerStatusBadge, KycBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState, NoResultsState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CustomerForm } from '@/features/customers/customer-form';

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const customers = useBankStore((s) => s.customers);
  const accounts = useBankStore((s) => s.accounts);
  const settings = useBankStore((s) => s.settings);
  const addCustomer = useBankStore((s) => s.addCustomer);
  const updateCustomer = useBankStore((s) => s.updateCustomer);
  const deleteCustomer = useBankStore((s) => s.deleteCustomer);

  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [kycFilter, setKycFilter] = useState<KycStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const canWrite = can(session?.role, 'customer:write');
  const canDelete = can(session?.role, 'customer:delete');

  // `?new=1` from the dashboard quick action opens the form directly.
  useEffect(() => {
    if (searchParams.get('new') === '1' && canWrite) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/customers');
    }
  }, [searchParams, canWrite, router]);

  // Account counts per customer, computed once rather than per row.
  const accountCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const account of accounts) {
      counts.set(account.customerId, (counts.get(account.customerId) ?? 0) + 1);
    }
    return counts;
  }, [accounts]);

  const filter = useCallback(
    (customer: Customer) =>
      (statusFilter === 'all' || customer.status === statusFilter) &&
      (kycFilter === 'all' || customer.kycStatus === kycFilter),
    [statusFilter, kycFilter],
  );

  const searchFields = useCallback(
    (customer: Customer) => [
      fullName(customer),
      customer.email,
      customer.customerCode,
      customer.phone,
      customer.city,
      customer.country,
    ],
    [],
  );

  const table = useDataTable<Customer>({
    data: customers,
    searchFields,
    filter,
    initialSort: { key: 'createdAt', direction: 'desc' },
    pageSize: 10,
  });

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (kycFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setStatusFilter('all');
    setKycFilter('all');
    table.reset();
  };

  const handleSubmit = (values: CustomerInput) => {
    if (!session) return;

    if (editing) {
      updateCustomer(editing.id, values, session.staffId);
      toast.success('Customer updated', `${values.firstName} ${values.lastName}’s record was saved.`);
    } else {
      addCustomer(values, session.staffId);
      toast.success('Customer created', `${values.firstName} ${values.lastName} was added.`);
    }

    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deleting || !session) return;

    const linkedAccounts = accountCounts.get(deleting.id) ?? 0;
    deleteCustomer(deleting.id, session.staffId);

    toast.success(
      'Customer deleted',
      linkedAccounts > 0
        ? `${fullName(deleting)} and ${linkedAccounts} linked account${linkedAccounts === 1 ? '' : 's'} were removed.`
        : `${fullName(deleting)} was removed.`,
    );
    setDeleting(null);
  };

  const handleExport = () => {
    exportCsv('customers', table.filteredAll, [
      { header: 'Code', value: (c) => c.customerCode },
      { header: 'Name', value: (c) => fullName(c) },
      { header: 'Email', value: (c) => c.email },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'City', value: (c) => c.city },
      { header: 'Country', value: (c) => c.country },
      { header: 'Status', value: (c) => c.status },
      { header: 'KYC', value: (c) => c.kycStatus },
      { header: 'Accounts', value: (c) => accountCounts.get(c.id) ?? 0 },
      { header: 'Joined', value: (c) => formatDate(c.createdAt, 'iso') },
    ]);
    toast.success('Export ready', `${table.filteredAll.length} customers exported to CSV.`);
  };

  if (!hydrated) return <PageSkeleton />;

  const columns: Column<Customer>[] = [
    {
      key: 'firstName',
      header: 'Customer',
      sortable: true,
      cell: (customer) => (
        <div className="flex items-center gap-3">
          <Avatar
            initials={initialsFromName(fullName(customer))}
            color={customer.avatarColor}
            size="sm"
            name={fullName(customer)}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-primary-text">{fullName(customer)}</p>
            <p className="truncate text-xs text-muted-text">{customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'customerCode',
      header: 'Code',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (customer) => <span className="text-xs tabular">{customer.customerCode}</span>,
    },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      className: 'hidden xl:table-cell',
      cell: (customer) => (
        <span className="text-xs text-secondary-text">
          {customer.city}, {customer.country}
        </span>
      ),
    },
    {
      key: 'accounts',
      header: 'Accounts',
      align: 'center',
      className: 'hidden sm:table-cell',
      cell: (customer) => (
        <span className="text-xs font-medium tabular">{accountCounts.get(customer.id) ?? 0}</span>
      ),
    },
    {
      key: 'kycStatus',
      header: 'KYC',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (customer) => <KycBadge status={customer.kycStatus} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (customer) => <CustomerStatusBadge status={customer.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '96px',
      cell: (customer) => (
        <div
          className="flex items-center justify-end gap-1"
          // Row-level navigation shouldn't fire when using these buttons.
          onClick={(event) => event.stopPropagation()}
        >
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${fullName(customer)}`}
              onClick={() => {
                setEditing(customer);
                setFormOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${fullName(customer)}`}
              onClick={() => setDeleting(customer)}
              className="text-negative hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        description={`${formatNumber(customers.length)} customer records across the bank.`}
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
                leftIcon={<UserPlus className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New customer
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        query={table.query}
        onQueryChange={table.setQuery}
        placeholder="Search by name, email, code or city…"
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as CustomerStatus | 'all'),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'blocked', label: 'Blocked' },
            ],
          },
          {
            label: 'KYC',
            value: kycFilter,
            onChange: (value) => setKycFilter(value as KycStatus | 'all'),
            options: [
              { value: 'all', label: 'All KYC' },
              { value: 'verified', label: 'Verified' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        page={table.page}
        rowKey={(customer) => customer.id}
        sortKey={table.sortKey as string | null}
        sortDirection={table.sortDirection}
        onSort={(key) => table.toggleSort(key as keyof Customer)}
        onRowClick={(customer) => router.push(`/customers/${customer.id}`)}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        dense={settings.density === 'compact'}
        emptyState={
          customers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden />}
              title="No customers yet"
              description="Create your first customer record to start opening accounts."
              action={
                canWrite
                  ? {
                      label: 'New customer',
                      onClick: () => {
                        setEditing(null);
                        setFormOpen(true);
                      },
                      icon: <UserPlus className="h-4 w-4" aria-hidden />,
                    }
                  : undefined
              }
            />
          ) : (
            <NoResultsState onClear={resetFilters} query={table.query} />
          )
        }
      />

      <CustomerForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        customer={editing}
        existingEmails={customers.map((c) => c.email)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete customer"
        message={
          deleting
            ? `Delete ${fullName(deleting)}? This also removes ${accountCounts.get(deleting.id) ?? 0} linked account(s), their transactions and any open requests. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete customer"
      />
    </div>
  );
}
