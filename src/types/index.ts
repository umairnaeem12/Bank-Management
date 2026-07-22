/**
 * Core domain types for the Bank Management platform.
 *
 * These interfaces are the contract between the data layer (currently
 * LocalStorage-backed mock repositories) and the UI. Swapping in a real
 * backend later should only require reimplementing the repositories in
 * `src/lib/repositories` — nothing here needs to change.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** ISO-8601 timestamp string, e.g. "2026-07-22T11:34:00.000Z". */
export type ISODateString = string;

/** All monetary values are stored as integer minor units (cents) to avoid
 *  floating-point drift. Use `formatCurrency` / `toMinor` helpers to convert. */
export type Cents = number;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortSpec<T> {
  key: keyof T;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Auth & staff
// ---------------------------------------------------------------------------

/** Roles are ordered by privilege; see `ROLE_RANK` in `lib/auth/permissions`. */
export type Role = 'admin' | 'manager' | 'teller' | 'auditor';

export type Permission =
  | 'customer:read'
  | 'customer:write'
  | 'customer:delete'
  | 'account:read'
  | 'account:write'
  | 'account:delete'
  | 'transaction:read'
  | 'transaction:write'
  | 'request:read'
  | 'request:write'
  | 'staff:read'
  | 'staff:write'
  | 'staff:delete'
  | 'report:read'
  | 'settings:write';

export type StaffStatus = 'active' | 'suspended' | 'on-leave';

export interface Staff {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  branch: string;
  status: StaffStatus;
  avatarColor: string;
  joinedAt: ISODateString;
  lastActiveAt: ISODateString;
}

/** The authenticated session persisted to LocalStorage. */
export interface Session {
  staffId: string;
  email: string;
  name: string;
  role: Role;
  issuedAt: ISODateString;
  expiresAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type KycStatus = 'verified' | 'pending' | 'rejected';

export interface Customer {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  country: string;
  dateOfBirth: ISODateString;
  status: CustomerStatus;
  kycStatus: KycStatus;
  avatarColor: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountType = 'savings' | 'checking' | 'fixed-deposit' | 'business';
export type AccountStatus = 'active' | 'dormant' | 'frozen' | 'closed';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'PKR';

export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  type: AccountType;
  status: AccountStatus;
  currency: Currency;
  /** Current balance in minor units. Mutated only via the transaction service. */
  balance: Cents;
  /** Overdraft allowance in minor units; withdrawals may not exceed
   *  `balance + overdraftLimit`. */
  overdraftLimit: Cents;
  interestRate: number;
  openedAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'fee';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Cents;
  currency: Currency;
  /** Source account for withdrawals/transfers; null for deposits. */
  fromAccountId: string | null;
  /** Destination account for deposits/transfers; null for withdrawals. */
  toAccountId: string | null;
  description: string;
  /** Balance of the *primary* account after this transaction settled. Kept
   *  denormalised so statement views don't need to replay history. */
  balanceAfter: Cents | null;
  createdAt: ISODateString;
  createdByStaffId: string;
}

// ---------------------------------------------------------------------------
// Service requests (order tracking)
// ---------------------------------------------------------------------------

export type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RequestType =
  | 'new-account'
  | 'card-issue'
  | 'loan-application'
  | 'cheque-book'
  | 'dispute'
  | 'account-closure';

export interface RequestEvent {
  id: string;
  status: RequestStatus;
  note: string;
  at: ISODateString;
  byStaffId: string;
}

export interface ServiceRequest {
  id: string;
  ticket: string;
  customerId: string;
  type: RequestType;
  status: RequestStatus;
  priority: RequestPriority;
  subject: string;
  details: string;
  assignedStaffId: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Append-only audit trail rendered as the request timeline. */
  timeline: RequestEvent[];
}

// ---------------------------------------------------------------------------
// Activity log & notifications
// ---------------------------------------------------------------------------

export type ActivityEntity =
  | 'customer'
  | 'account'
  | 'transaction'
  | 'request'
  | 'staff'
  | 'auth'
  | 'settings';

export interface ActivityLog {
  id: string;
  staffId: string;
  action: string;
  entity: ActivityEntity;
  entityId: string | null;
  at: ISODateString;
}

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  read: boolean;
  at: ISODateString;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  /** Default currency used to render aggregate figures on the dashboard. */
  baseCurrency: Currency;
  dateFormat: 'iso' | 'us' | 'eu';
  density: 'comfortable' | 'compact';
  notifications: {
    transactionAlerts: boolean;
    requestUpdates: boolean;
    weeklyDigest: boolean;
    productNews: boolean;
  };
}
