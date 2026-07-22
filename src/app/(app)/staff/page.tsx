'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Pencil, Trash2, UserCog, UserPlus } from 'lucide-react';
import type { Role, Staff, StaffStatus } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore, type StaffInput } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDataTable } from '@/hooks/use-data-table';
import { useStaffWithWorkload } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { ROLE_LABELS, can, canManageStaffOfRole } from '@/lib/auth/permissions';
import { exportCsv } from '@/lib/utils/export';
import {
  formatDate,
  formatNumber,
  formatRelative,
  fullName,
  initialsFromName,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge, StaffStatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState, NoResultsState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StaffForm } from '@/features/staff/staff-form';

type StaffRow = Staff & { openRequests: number };

const ROLE_TONES: Record<Role, 'brand' | 'info' | 'success' | 'neutral'> = {
  admin: 'brand',
  manager: 'info',
  teller: 'success',
  auditor: 'neutral',
};

export default function StaffPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const session = useAuthStore((s) => s.session);
  const staff = useBankStore((s) => s.staff);
  const settings = useBankStore((s) => s.settings);
  const addStaff = useBankStore((s) => s.addStaff);
  const updateStaff = useBankStore((s) => s.updateStaff);
  const deleteStaff = useBankStore((s) => s.deleteStaff);

  const rows = useStaffWithWorkload();

  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);

  const canWrite = can(session?.role, 'staff:write');
  const canDelete = can(session?.role, 'staff:delete');

  const filter = useCallback(
    (member: StaffRow) =>
      (roleFilter === 'all' || member.role === roleFilter) &&
      (statusFilter === 'all' || member.status === statusFilter),
    [roleFilter, statusFilter],
  );

  const searchFields = useCallback(
    (member: StaffRow) => [
      fullName(member),
      member.email,
      member.employeeCode,
      member.branch,
      member.role,
    ],
    [],
  );

  const table = useDataTable<StaffRow>({
    data: rows,
    searchFields,
    filter,
    initialSort: { key: 'firstName', direction: 'asc' },
    pageSize: 10,
  });

  const activeFilterCount = (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    table.reset();
  };

  const handleSubmit = (values: StaffInput) => {
    if (!session) return;

    if (editing) {
      updateStaff(editing.id, values, session.staffId);
      toast.success('Staff updated', `${values.firstName} ${values.lastName}’s record was saved.`);
    } else {
      addStaff(values, session.staffId);
      toast.success('Staff added', `${values.firstName} ${values.lastName} now has access.`);
    }

    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deleting || !session) return;

    deleteStaff(deleting.id, session.staffId);
    toast.success(
      'Staff removed',
      `${fullName(deleting)} no longer has access. Their open requests were returned to the pool.`,
    );
    setDeleting(null);
  };

  const handleExport = () => {
    exportCsv('staff', table.filteredAll, [
      { header: 'Employee code', value: (s) => s.employeeCode },
      { header: 'Name', value: (s) => fullName(s) },
      { header: 'Email', value: (s) => s.email },
      { header: 'Phone', value: (s) => s.phone },
      { header: 'Role', value: (s) => ROLE_LABELS[s.role] },
      { header: 'Branch', value: (s) => s.branch },
      { header: 'Status', value: (s) => s.status },
      { header: 'Open requests', value: (s) => s.openRequests },
      { header: 'Joined', value: (s) => formatDate(s.joinedAt, 'iso') },
    ]);
    toast.success('Export ready', `${table.filteredAll.length} staff records exported to CSV.`);
  };

  if (!hydrated) return <PageSkeleton />;

  const columns: Column<StaffRow>[] = [
    {
      key: 'firstName',
      header: 'Staff member',
      sortable: true,
      cell: (member) => (
        <div className="flex items-center gap-3">
          <Avatar
            initials={initialsFromName(fullName(member))}
            color={member.avatarColor}
            size="sm"
            name={fullName(member)}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-primary-text">{fullName(member)}</p>
            <p className="truncate text-xs text-muted-text">{member.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeCode',
      header: 'Code',
      sortable: true,
      className: 'hidden xl:table-cell',
      cell: (member) => <span className="text-xs tabular">{member.employeeCode}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      cell: (member) => <Badge tone={ROLE_TONES[member.role]}>{ROLE_LABELS[member.role]}</Badge>,
    },
    {
      key: 'branch',
      header: 'Branch',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (member) => <span className="text-xs text-secondary-text">{member.branch}</span>,
    },
    {
      key: 'openRequests',
      header: 'Open work',
      sortable: true,
      align: 'center',
      className: 'hidden sm:table-cell',
      cell: (member) => (
        <span className="text-xs font-medium tabular">{member.openRequests}</span>
      ),
    },
    {
      key: 'lastActiveAt',
      header: 'Last active',
      sortable: true,
      className: 'hidden xl:table-cell',
      cell: (member) => (
        <span className="text-xs text-muted-text">{formatRelative(member.lastActiveAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (member) => <StaffStatusBadge status={member.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '96px',
      cell: (member) => {
        // Staff can only act on records below their own rank; the demo admin
        // record is protected so the reviewer can't lock themselves out.
        const manageable = canManageStaffOfRole(session?.role, member.role);
        const isSelf = member.id === session?.staffId;

        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {canWrite && manageable && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${fullName(member)}`}
                onClick={() => {
                  setEditing(member);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
            {canDelete && manageable && !isSelf && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${fullName(member)}`}
                onClick={() => setDeleting(member)}
                className="text-negative hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Staff"
        description={`${formatNumber(staff.length)} employees · ${formatNumber(staff.filter((s) => s.status === 'active').length)} currently active.`}
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
                Add staff
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        query={table.query}
        onQueryChange={table.setQuery}
        placeholder="Search by name, email, code or branch…"
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
        filters={[
          {
            label: 'Role',
            value: roleFilter,
            onChange: (value) => setRoleFilter(value as Role | 'all'),
            options: [
              { value: 'all', label: 'All roles' },
              { value: 'admin', label: 'Administrator' },
              { value: 'manager', label: 'Branch Manager' },
              { value: 'teller', label: 'Teller' },
              { value: 'auditor', label: 'Auditor' },
            ],
          },
          {
            label: 'Status',
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as StaffStatus | 'all'),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'on-leave', label: 'On leave' },
              { value: 'suspended', label: 'Suspended' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        page={table.page}
        rowKey={(member) => member.id}
        sortKey={table.sortKey as string | null}
        sortDirection={table.sortDirection}
        onSort={(key) => table.toggleSort(key as keyof StaffRow)}
        onRowClick={(member) => router.push(`/staff/${member.id}`)}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        dense={settings.density === 'compact'}
        emptyState={
          staff.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-6 w-6" aria-hidden />}
              title="No staff records"
              description="Add employees to give them access to the console."
            />
          ) : (
            <NoResultsState onClear={resetFilters} query={table.query} />
          )
        }
      />

      <StaffForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        member={editing}
        existingEmails={staff.map((s) => s.email)}
        actorRole={session?.role}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove staff member"
        message={
          deleting
            ? `Remove ${fullName(deleting)} from the console? Any requests assigned to them will return to the unassigned pool.`
            : ''
        }
        confirmLabel="Remove staff member"
      />
    </div>
  );
}
