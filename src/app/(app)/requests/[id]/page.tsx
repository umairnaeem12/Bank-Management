'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';
import type { RequestStatus } from '@/types';
import { useAuthStore } from '@/store/use-auth-store';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLookups } from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { can } from '@/lib/auth/permissions';
import { formatDateTime, formatRelative, fullName, initialsFromName, titleCase } from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriorityBadge, RequestStatusBadge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Select, Textarea } from '@/components/ui/input';

const STATUS_ICONS: Record<RequestStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" aria-hidden />,
  processing: <PlayCircle className="h-3.5 w-3.5" aria-hidden />,
  completed: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  rejected: <XCircle className="h-3.5 w-3.5" aria-hidden />,
};

const STATUS_RING: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  processing: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);

  const requests = useBankStore((s) => s.requests);
  const staff = useBankStore((s) => s.staff);
  const updateRequestStatus = useBankStore((s) => s.updateRequestStatus);
  const assignRequest = useBankStore((s) => s.assignRequest);

  const { customerById, staffById } = useLookups();

  const [statusModal, setStatusModal] = useState<RequestStatus | null>(null);
  const [note, setNote] = useState('');

  const request = requests.find((r) => r.id === id);
  const canWrite = can(session?.role, 'request:write');

  if (!hydrated) return <PageSkeleton />;

  if (!request) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Request not found"
          breadcrumbs={[{ label: 'Requests', href: '/requests' }, { label: 'Not found' }]}
        />
        <Card>
          <ErrorState
            title="We couldn’t find that request"
            description="It may have been removed along with its customer record."
            onRetry={() => router.push('/requests')}
          />
        </Card>
      </div>
    );
  }

  const customer = customerById.get(request.customerId);
  const assignee = request.assignedStaffId ? staffById.get(request.assignedStaffId) : undefined;
  const isOpen = request.status === 'pending' || request.status === 'processing';

  const confirmStatusChange = () => {
    if (!statusModal || !session) return;

    updateRequestStatus(request.id, statusModal, note.trim(), session.staffId);
    toast.success('Request updated', `${request.ticket} is now ${statusModal}.`);
    setStatusModal(null);
    setNote('');
  };

  const handleAssign = (staffId: string) => {
    if (!session) return;

    assignRequest(request.id, staffId || null, session.staffId);
    const member = staffId ? staffById.get(staffId) : null;
    toast.success(
      'Assignment updated',
      member ? `${request.ticket} assigned to ${fullName(member)}.` : `${request.ticket} returned to the pool.`,
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={request.subject}
        description={`${request.ticket} · logged ${formatRelative(request.createdAt)}`}
        breadcrumbs={[{ label: 'Requests', href: '/requests' }, { label: request.ticket }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              onClick={() => router.push('/requests')}
            >
              Back
            </Button>

            {canWrite && isOpen && (
              <>
                {request.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<PlayCircle className="h-4 w-4" aria-hidden />}
                    onClick={() => setStatusModal('processing')}
                  >
                    Start processing
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  leftIcon={<XCircle className="h-4 w-4" aria-hidden />}
                  onClick={() => setStatusModal('rejected')}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                  onClick={() => setStatusModal('completed')}
                >
                  Complete
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Request details</CardTitle>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={request.priority} />
                <RequestStatusBadge status={request.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-secondary-text">{request.details}</p>

              <dl className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-text">Type</dt>
                  <dd className="mt-0.5 text-sm font-medium text-primary-text">
                    {titleCase(request.type)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-text">Customer</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {customer ? (
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {fullName(customer)}
                      </Link>
                    ) : (
                      <span className="text-muted-text">Unknown</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-text">Logged</dt>
                  <dd className="mt-0.5 text-sm font-medium text-primary-text">
                    {formatDateTime(request.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-text">Last updated</dt>
                  <dd className="mt-0.5 text-sm font-medium text-primary-text">
                    {formatDateTime(request.updatedAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Timeline — the append-only audit trail. */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <span className="text-xs text-muted-text">
                {request.timeline.length} event{request.timeline.length === 1 ? '' : 's'}
              </span>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5">
                {request.timeline.map((event, index) => {
                  const actor = staffById.get(event.byStaffId);
                  const isLast = index === request.timeline.length - 1;

                  return (
                    <li key={event.id} className="relative flex gap-4">
                      {/* Connector line; omitted on the last item. */}
                      {!isLast && (
                        <span
                          className="absolute left-3.5 top-8 h-[calc(100%+0.5rem)] w-px bg-border-subtle"
                          aria-hidden
                        />
                      )}

                      <span
                        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${STATUS_RING[event.status]}`}
                        aria-hidden
                      >
                        {STATUS_ICONS[event.status]}
                      </span>

                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-primary-text">
                            {titleCase(event.status)}
                          </p>
                          <span className="text-xs text-muted-text">
                            {formatRelative(event.at)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-secondary-text">
                          {event.note}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-text">
                          {actor ? fullName(actor) : 'System'} · {formatDateTime(event.at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Assignment */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignee ? (
              <div className="flex items-center gap-3">
                <Avatar
                  initials={initialsFromName(fullName(assignee))}
                  color={assignee.avatarColor}
                  size="md"
                  name={fullName(assignee)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary-text">
                    {fullName(assignee)}
                  </p>
                  <p className="truncate text-xs text-muted-text">
                    {titleCase(assignee.role)} · {assignee.branch}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-text">
                This request is unassigned and sits in the shared pool.
              </p>
            )}

            {canWrite && (
              <Select
                label="Assign to"
                value={request.assignedStaffId ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...staff
                    .filter((s) => s.status === 'active')
                    .map((s) => ({ value: s.id, label: `${fullName(s)} · ${s.branch}` })),
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status-change dialog — a note is required so the trail stays useful. */}
      <Modal
        open={statusModal !== null}
        onClose={() => {
          setStatusModal(null);
          setNote('');
        }}
        title={`Move to ${statusModal ?? ''}`}
        description="Add a note explaining this change. It is recorded on the timeline."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusModal(null);
                setNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={statusModal === 'rejected' ? 'danger' : 'primary'}
              onClick={confirmStatusChange}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Textarea
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={
            statusModal === 'completed'
              ? 'Request fulfilled and the customer has been notified.'
              : statusModal === 'rejected'
                ? 'Rejected — supporting documentation was insufficient.'
                : 'Assigned to an officer and under review.'
          }
          hint="Leave blank to record a default note."
        />
      </Modal>
    </div>
  );
}
