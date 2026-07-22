'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/auth/permissions';
import {
  formatDate,
  formatDateTime,
  formatRelative,
  fullName,
  initialsFromName,
  titleCase,
} from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, PriorityBadge, RequestStatusBadge, StaffStatusBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const router = useRouter();
  const hydrated = useHydrated();

  const staff = useBankStore((s) => s.staff);
  const requests = useBankStore((s) => s.requests);
  const activity = useBankStore((s) => s.activity);

  const member = staff.find((s) => s.id === id);

  const assigned = useMemo(
    () => (member ? requests.filter((r) => r.assignedStaffId === member.id) : []),
    [requests, member],
  );

  const logs = useMemo(
    () => (member ? activity.filter((a) => a.staffId === member.id).slice(0, 20) : []),
    [activity, member],
  );

  if (!hydrated) return <PageSkeleton />;

  if (!member) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Staff member not found"
          breadcrumbs={[{ label: 'Staff', href: '/staff' }, { label: 'Not found' }]}
        />
        <Card>
          <ErrorState
            title="We couldn’t find that staff member"
            description="The record may have been removed."
            onRetry={() => router.push('/staff')}
          />
        </Card>
      </div>
    );
  }

  const open = assigned.filter((r) => r.status === 'pending' || r.status === 'processing');
  const closed = assigned.filter((r) => r.status === 'completed' || r.status === 'rejected');
  const permissions = ROLE_PERMISSIONS[member.role];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={fullName(member)}
        description={`${ROLE_LABELS[member.role]} · ${member.branch}`}
        breadcrumbs={[{ label: 'Staff', href: '/staff' }, { label: fullName(member) }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
            onClick={() => router.push('/staff')}
          >
            Back
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center text-center">
            <Avatar
              initials={initialsFromName(fullName(member))}
              color={member.avatarColor}
              size="xl"
              name={fullName(member)}
            />
            <h2 className="mt-4 text-lg font-semibold text-primary-text">{fullName(member)}</h2>
            <p className="text-xs text-muted-text tabular">{member.employeeCode}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge tone="brand">{ROLE_LABELS[member.role]}</Badge>
              <StaffStatusBadge status={member.status} />
            </div>

            <dl className="mt-6 w-full space-y-3 text-left">
              <DetailRow
                icon={<Mail className="h-4 w-4" aria-hidden />}
                label="Email"
                value={member.email}
              />
              <DetailRow
                icon={<Phone className="h-4 w-4" aria-hidden />}
                label="Phone"
                value={member.phone}
              />
              <DetailRow
                icon={<Building2 className="h-4 w-4" aria-hidden />}
                label="Branch"
                value={member.branch}
              />
              <DetailRow
                icon={<CalendarDays className="h-4 w-4" aria-hidden />}
                label="Joined"
                value={formatDate(member.joinedAt)}
              />
              <DetailRow
                icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                label="Last active"
                value={formatRelative(member.lastActiveAt)}
              />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {/* Workload */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Open requests" value={String(open.length)} />
            <SummaryTile label="Closed requests" value={String(closed.length)} />
            <SummaryTile label="Logged actions" value={String(logs.length)} />
          </div>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Access &amp; permissions</CardTitle>
                <p className="mt-0.5 text-xs text-muted-text">
                  {ROLE_DESCRIPTIONS[member.role]}
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 text-muted-text" aria-hidden />
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {permissions.map((permission) => (
                  <li key={permission}>
                    <Badge tone={permission.endsWith(':read') ? 'neutral' : 'brand'}>
                      {permission}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-text">
                Permissions are derived from the role and control what this user sees and can do.
              </p>
            </CardContent>
          </Card>

          {/* Assigned requests */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned requests</CardTitle>
              <span className="text-xs text-muted-text">{assigned.length} total</span>
            </CardHeader>
            <CardContent className="p-0">
              {assigned.length === 0 ? (
                <EmptyState
                  title="No assigned requests"
                  description="This staff member has no requests assigned to them."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {assigned.slice(0, 8).map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/requests/${request.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-primary-text">{request.subject}</p>
                          <p className="truncate text-xs text-muted-text tabular">
                            {request.ticket} · {formatRelative(request.updatedAt)}
                          </p>
                        </div>
                        <PriorityBadge priority={request.priority} />
                        <RequestStatusBadge status={request.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Activity log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
              <span className="text-xs text-muted-text">Most recent first</span>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <EmptyState
                  title="No recorded activity"
                  description="Actions taken in the console will appear here."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {logs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-primary-text">{log.action}</p>
                        <p className="mt-0.5 text-xs text-muted-text">
                          {titleCase(log.entity)} · {formatDateTime(log.at)}
                        </p>
                      </div>
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4 card-shadow">
      <p className="text-xs text-muted-text">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-primary-text tabular">{value}</p>
    </div>
  );
}
