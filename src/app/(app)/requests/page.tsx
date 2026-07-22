'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Download, Plus } from 'lucide-react';
import type {
  RequestPriority,
  RequestStatus,
  RequestType,
  ServiceRequest,
} from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore, type RequestInput } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDataTable } from '@/hooks/use-data-table';
import { useLookups, useRequestQueue } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { exportCsv } from '@/lib/utils/export';
import { formatDate, formatNumber, formatRelative, fullName, titleCase } from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge, PriorityBadge, RequestStatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState, NoResultsState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { RequestForm } from '@/features/requests/request-form';

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const requests = useBankStore((s) => s.requests);
  const customers = useBankStore((s) => s.customers);
  const staff = useBankStore((s) => s.staff);
  const settings = useBankStore((s) => s.settings);
  const addRequest = useBankStore((s) => s.addRequest);

  const { customerById, staffById } = useLookups();
  const queue = useRequestQueue();

  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);

  const canWrite = can(session?.role, 'request:write');

  useEffect(() => {
    if (searchParams.get('new') === '1' && canWrite) {
      setFormOpen(true);
      router.replace('/requests');
    }
  }, [searchParams, canWrite, router]);

  const filter = useCallback(
    (request: ServiceRequest) =>
      (statusFilter === 'all' || request.status === statusFilter) &&
      (priorityFilter === 'all' || request.priority === priorityFilter) &&
      (typeFilter === 'all' || request.type === typeFilter),
    [statusFilter, priorityFilter, typeFilter],
  );

  const searchFields = useCallback(
    (request: ServiceRequest) => {
      const customer = customerById.get(request.customerId);
      return [
        request.ticket,
        request.subject,
        request.type,
        customer ? fullName(customer) : '',
      ];
    },
    [customerById],
  );

  const table = useDataTable<ServiceRequest>({
    data: requests,
    searchFields,
    filter,
    initialSort: { key: 'createdAt', direction: 'desc' },
    pageSize: 10,
  });

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setTypeFilter('all');
    table.reset();
  };

  const handleSubmit = (values: RequestInput) => {
    if (!session) return;

    const created = addRequest(values, session.staffId);
    toast.success('Request logged', `${created.ticket} has been added to the queue.`);
    setFormOpen(false);
  };

  const handleExport = () => {
    exportCsv('service-requests', table.filteredAll, [
      { header: 'Ticket', value: (r) => r.ticket },
      {
        header: 'Customer',
        value: (r) => {
          const customer = customerById.get(r.customerId);
          return customer ? fullName(customer) : 'Unknown';
        },
      },
      { header: 'Type', value: (r) => titleCase(r.type) },
      { header: 'Subject', value: (r) => r.subject },
      { header: 'Priority', value: (r) => r.priority },
      { header: 'Status', value: (r) => r.status },
      {
        header: 'Assigned to',
        value: (r) => {
          if (!r.assignedStaffId) return 'Unassigned';
          const member = staffById.get(r.assignedStaffId);
          return member ? fullName(member) : 'Unknown';
        },
      },
      { header: 'Created', value: (r) => formatDate(r.createdAt, 'iso') },
      { header: 'Updated', value: (r) => formatDate(r.updatedAt, 'iso') },
    ]);
    toast.success('Export ready', `${table.filteredAll.length} requests exported to CSV.`);
  };

  if (!hydrated) return <PageSkeleton />;

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    processing: requests.filter((r) => r.status === 'processing').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  const columns: Column<ServiceRequest>[] = [
    {
      key: 'ticket',
      header: 'Ticket',
      sortable: true,
      cell: (request) => {
        const customer = customerById.get(request.customerId);
        return (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-primary-text tabular">
              {request.ticket}
            </p>
            <p className="truncate text-xs text-muted-text">
              {customer ? fullName(customer) : 'Unknown customer'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'subject',
      header: 'Subject',
      sortable: true,
      cell: (request) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-primary-text">{request.subject}</p>
          <p className="truncate text-xs text-muted-text">{titleCase(request.type)}</p>
        </div>
      ),
    },
    {
      key: 'assignedStaffId',
      header: 'Assigned',
      className: 'hidden lg:table-cell',
      cell: (request) => {
        if (!request.assignedStaffId) {
          return <Badge tone="neutral">Unassigned</Badge>;
        }
        const member = staffById.get(request.assignedStaffId);
        return (
          <span className="text-xs text-secondary-text">
            {member ? fullName(member) : 'Unknown'}
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      className: 'hidden sm:table-cell',
      cell: (request) => <PriorityBadge priority={request.priority} />,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      className: 'hidden xl:table-cell',
      cell: (request) => (
        <span className="text-xs text-muted-text">{formatRelative(request.updatedAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (request) => <RequestStatusBadge status={request.status} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Service requests"
        description={`${formatNumber(counts.pending + counts.processing)} open of ${formatNumber(requests.length)} total.`}
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
                onClick={() => setFormOpen(true)}
              >
                Log request
              </Button>
            )}
          </>
        }
      />

      {/* Status summary */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusTile label="Pending" count={counts.pending} tone="warning" />
        <StatusTile label="Processing" count={counts.processing} tone="info" />
        <StatusTile label="Completed" count={counts.completed} tone="success" />
        <StatusTile label="Rejected" count={counts.rejected} tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <FilterBar
            query={table.query}
            onQueryChange={table.setQuery}
            placeholder="Search by ticket, subject or customer…"
            activeFilterCount={activeFilterCount}
            onReset={resetFilters}
            filters={[
              {
                label: 'Status',
                value: statusFilter,
                onChange: (value) => setStatusFilter(value as RequestStatus | 'all'),
                options: [
                  { value: 'all', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'processing', label: 'Processing' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'rejected', label: 'Rejected' },
                ],
              },
              {
                label: 'Priority',
                value: priorityFilter,
                onChange: (value) => setPriorityFilter(value as RequestPriority | 'all'),
                options: [
                  { value: 'all', label: 'All priorities' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'high', label: 'High' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'low', label: 'Low' },
                ],
              },
              {
                label: 'Type',
                value: typeFilter,
                onChange: (value) => setTypeFilter(value as RequestType | 'all'),
                options: [
                  { value: 'all', label: 'All types' },
                  { value: 'new-account', label: 'New account' },
                  { value: 'card-issue', label: 'Card issue' },
                  { value: 'loan-application', label: 'Loan application' },
                  { value: 'cheque-book', label: 'Cheque book' },
                  { value: 'dispute', label: 'Dispute' },
                  { value: 'account-closure', label: 'Account closure' },
                ],
              },
            ]}
          />

          <DataTable
            columns={columns}
            page={table.page}
            rowKey={(request) => request.id}
            sortKey={table.sortKey as string | null}
            sortDirection={table.sortDirection}
            onSort={(key) => table.toggleSort(key as keyof ServiceRequest)}
            onRowClick={(request) => router.push(`/requests/${request.id}`)}
            onPageChange={table.setPage}
            pageSize={table.pageSize}
            onPageSizeChange={table.setPageSize}
            dense={settings.density === 'compact'}
            emptyState={
              requests.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" aria-hidden />}
                  title="No requests yet"
                  description="Customer requests will appear here once logged."
                  action={
                    canWrite
                      ? {
                          label: 'Log request',
                          onClick: () => setFormOpen(true),
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
        </div>

        {/* Processing queue — priority order, oldest first within a band. */}
        <Card className="h-fit xl:col-span-1">
          <CardHeader>
            <div>
              <CardTitle>Work queue</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">By priority, then age</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {queue.length === 0 ? (
              <EmptyState title="Queue is clear" description="No open requests." />
            ) : (
              <ol className="divide-y divide-border-subtle">
                {queue.slice(0, 8).map((request, index) => (
                  <li key={request.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/requests/${request.id}`)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-secondary-text tabular">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-primary-text">
                          {request.subject}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-text">
                          {request.ticket} · {formatRelative(request.createdAt)}
                        </span>
                      </span>
                      <PriorityBadge priority={request.priority} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <RequestForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        customers={customers}
        staff={staff}
      />
    </div>
  );
}

function StatusTile({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'warning' | 'info' | 'success' | 'danger';
}) {
  const accents = {
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4 card-shadow">
      <p className="text-xs text-muted-text">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular ${accents[tone]}`}>
        {formatNumber(count)}
      </p>
    </div>
  );
}
