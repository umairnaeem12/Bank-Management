import { cn } from '@/lib/utils/cn';
import type {
  AccountStatus,
  CustomerStatus,
  KycStatus,
  RequestPriority,
  RequestStatus,
  StaffStatus,
  TransactionStatus,
} from '@/types';
import { titleCase } from '@/lib/utils/format';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Renders a leading dot — useful for status columns in dense tables. */
  dot?: boolean;
}

export function Badge({ className, tone = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Domain status → tone maps.
 *
 * Centralised so "frozen" is the same red everywhere it appears, rather than
 * each table picking its own colour.
 * ------------------------------------------------------------------------- */

const CUSTOMER_TONES: Record<CustomerStatus, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  blocked: 'danger',
};

const KYC_TONES: Record<KycStatus, BadgeTone> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
};

const ACCOUNT_TONES: Record<AccountStatus, BadgeTone> = {
  active: 'success',
  dormant: 'warning',
  frozen: 'danger',
  closed: 'neutral',
};

const TRANSACTION_TONES: Record<TransactionStatus, BadgeTone> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  reversed: 'neutral',
};

const REQUEST_TONES: Record<RequestStatus, BadgeTone> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  rejected: 'danger',
};

const PRIORITY_TONES: Record<RequestPriority, BadgeTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const STAFF_TONES: Record<StaffStatus, BadgeTone> = {
  active: 'success',
  suspended: 'danger',
  'on-leave': 'warning',
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return <Badge tone={CUSTOMER_TONES[status]} dot>{titleCase(status)}</Badge>;
}

export function KycBadge({ status }: { status: KycStatus }) {
  return <Badge tone={KYC_TONES[status]}>{titleCase(status)}</Badge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={ACCOUNT_TONES[status]} dot>{titleCase(status)}</Badge>;
}

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge tone={TRANSACTION_TONES[status]} dot>{titleCase(status)}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONES[status]} dot>{titleCase(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: RequestPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{titleCase(priority)}</Badge>;
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return <Badge tone={STAFF_TONES[status]} dot>{titleCase(status)}</Badge>;
}
