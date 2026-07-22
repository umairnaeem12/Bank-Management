/**
 * Deterministic demo dataset.
 *
 * Everything is generated from a fixed seed so the app looks identical on
 * every machine and reload. Dates are generated relative to a `now` argument
 * supplied by the caller (never `Date.now()` at module scope) so that the
 * dataset stays stable within a session and hydration never mismatches.
 */

import type {
  Account,
  AccountStatus,
  AccountType,
  ActivityLog,
  AppNotification,
  Currency,
  Customer,
  CustomerStatus,
  KycStatus,
  RequestEvent,
  RequestPriority,
  RequestStatus,
  RequestType,
  ServiceRequest,
  Role,
  Staff,
  StaffStatus,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/types';
import { createRng, padCode, pick, randomInt } from '@/lib/utils/id';

/** Bump when the shape of generated data changes, to force a reseed. */
export const SEED_VERSION = 4;

const SEED = 20260722;

const FIRST_NAMES = [
  'Ayesha', 'Daniel', 'Priya', 'Marcus', 'Sofia', 'Omar', 'Elena', 'Jonah',
  'Fatima', 'Liam', 'Noor', 'Grace', 'Hassan', 'Mia', 'Tobias', 'Zara',
  'Ibrahim', 'Clara', 'Yusuf', 'Nadia', 'Samuel', 'Leila', 'Arjun', 'Ruth',
  'Farhan', 'Amara', 'Victor', 'Ines', 'Rafael', 'Hana', 'Kenji', 'Adaeze',
];

const LAST_NAMES = [
  'Khan', 'Whitfield', 'Nair', 'Osei', 'Marchetti', 'Haddad', 'Petrova', 'Lindqvist',
  'Rahman', 'O’Connell', 'Siddiqui', 'Mensah', 'Ferreira', 'Bauer', 'Novak', 'Aziz',
  'Delgado', 'Fontaine', 'Yilmaz', 'Costa', 'Okafor', 'Kowalski', 'Tanaka', 'Baptiste',
];

const CITIES: Array<[string, string]> = [
  ['London', 'United Kingdom'],
  ['Karachi', 'Pakistan'],
  ['Berlin', 'Germany'],
  ['New York', 'United States'],
  ['Toronto', 'Canada'],
  ['Dubai', 'United Arab Emirates'],
  ['Lisbon', 'Portugal'],
  ['Nairobi', 'Kenya'],
  ['Singapore', 'Singapore'],
  ['Sydney', 'Australia'],
];

const STREETS = [
  'Ashgrove Lane', 'Marine Drive', 'Kaiserstrasse', 'Hudson Street', 'Bloor Avenue',
  'Jumeirah Road', 'Rua do Carmo', 'Ngong Road', 'Orchard Boulevard', 'Darling Point',
];

const BRANCHES = [
  'Central HQ', 'Northgate', 'Harbour Point', 'Westfield', 'Riverside', 'Airport City',
];

/** Tailwind-ish hues used for deterministic avatar colours. */
const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ea580c',
  '#4f46e5', '#0891b2', '#c026d3', '#059669', '#e11d48',
];

const TRANSACTION_NOTES: Record<TransactionType, string[]> = {
  deposit: ['Salary credit', 'Cash deposit at branch', 'Cheque clearance', 'Inbound wire', 'Refund credit'],
  withdrawal: ['ATM withdrawal', 'Branch cash withdrawal', 'Card purchase', 'Utility payment', 'Standing order'],
  transfer: ['Internal transfer', 'Rent payment', 'Family support', 'Invoice settlement', 'Savings top-up'],
  fee: ['Monthly maintenance fee', 'Wire transfer fee', 'Overdraft fee', 'Card replacement fee'],
};

const REQUEST_SUBJECTS: Record<RequestType, string> = {
  'new-account': 'Open a new savings account',
  'card-issue': 'Debit card not working',
  'loan-application': 'Personal loan application',
  'cheque-book': 'Request new cheque book',
  dispute: 'Dispute unrecognised transaction',
  'account-closure': 'Close dormant account',
};

const REQUEST_DETAILS: Record<RequestType, string> = {
  'new-account':
    'Customer would like to open an additional savings account with a standing monthly transfer from their current account.',
  'card-issue':
    'Card is being declined at point of sale despite sufficient balance. Customer requests a replacement and a review of recent declines.',
  'loan-application':
    'Customer has applied for an unsecured personal loan. Income documents supplied; awaiting credit assessment.',
  'cheque-book':
    'Customer has exhausted their current cheque book and requests a replacement of 50 leaves to their registered address.',
  dispute:
    'Customer does not recognise a card transaction on their statement and has asked for it to be investigated and reversed.',
  'account-closure':
    'Customer wishes to close a dormant account and transfer the remaining balance to their primary current account.',
};

const DAY_MS = 86_400_000;

/** The full mock database. */
export interface SeedData {
  customers: Customer[];
  accounts: Account[];
  transactions: Transaction[];
  requests: ServiceRequest[];
  staff: Staff[];
  activity: ActivityLog[];
  notifications: AppNotification[];
}

/**
 * Builds the entire demo dataset.
 *
 * @param now Epoch millis used as "today"; all dates are offsets from this.
 */
export function generateSeedData(now: number): SeedData {
  const rng = createRng(SEED);

  const staff = generateStaff(rng, now);
  const customers = generateCustomers(rng, now);
  const accounts = generateAccounts(rng, now, customers);
  const transactions = generateTransactions(rng, now, accounts, staff);
  const requests = generateRequests(rng, now, customers, staff);
  const activity = generateActivity(rng, now, staff, customers, transactions);
  const notifications = generateNotifications(now, requests, transactions);

  return { customers, accounts, transactions, requests, staff, activity, notifications };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/**
 * The first four records are the demo login accounts and are fixed rather than
 * random, so the credentials shown on the login page always work.
 */
const DEMO_STAFF: Array<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}> = [
  { id: 'stf_admin', firstName: 'Amelia', lastName: 'Hart', email: 'admin@northbank.com', role: 'admin' },
  { id: 'stf_manager', firstName: 'Rohan', lastName: 'Mehta', email: 'manager@northbank.com', role: 'manager' },
  { id: 'stf_teller', firstName: 'Chloe', lastName: 'Baptiste', email: 'teller@northbank.com', role: 'teller' },
  { id: 'stf_auditor', firstName: 'Daniel', lastName: 'Osei', email: 'auditor@northbank.com', role: 'auditor' },
];

function generateStaff(rng: () => number, now: number): Staff[] {
  const staff: Staff[] = DEMO_STAFF.map((demo, i) => ({
    id: demo.id,
    employeeCode: `EMP-${padCode(i + 1, 4)}`,
    firstName: demo.firstName,
    lastName: demo.lastName,
    email: demo.email,
    phone: `+44 20 7${randomInt(rng, 100, 999)} ${randomInt(rng, 1000, 9999)}`,
    role: demo.role,
    branch: BRANCHES[i % BRANCHES.length],
    status: 'active',
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    joinedAt: new Date(now - randomInt(rng, 400, 1800) * DAY_MS).toISOString(),
    lastActiveAt: new Date(now - randomInt(rng, 0, 6) * 3_600_000).toISOString(),
  }));

  const extraRoles: Role[] = ['teller', 'teller', 'manager', 'teller', 'auditor', 'teller', 'manager', 'teller'];
  const statuses: StaffStatus[] = ['active', 'active', 'active', 'active', 'on-leave', 'suspended'];

  for (let i = 0; i < extraRoles.length; i++) {
    const firstName = pick(rng, FIRST_NAMES);
    const lastName = pick(rng, LAST_NAMES);
    const idx = DEMO_STAFF.length + i;

    staff.push({
      id: `stf_${padCode(idx + 1, 4)}`,
      employeeCode: `EMP-${padCode(idx + 1, 4)}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${slug(lastName)}@northbank.com`,
      phone: `+44 20 7${randomInt(rng, 100, 999)} ${randomInt(rng, 1000, 9999)}`,
      role: extraRoles[i],
      branch: pick(rng, BRANCHES),
      status: pick(rng, statuses),
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      joinedAt: new Date(now - randomInt(rng, 60, 1500) * DAY_MS).toISOString(),
      lastActiveAt: new Date(now - randomInt(rng, 0, 30) * DAY_MS).toISOString(),
    });
  }

  return staff;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const CUSTOMER_COUNT = 48;

function generateCustomers(rng: () => number, now: number): Customer[] {
  const customers: Customer[] = [];
  const statuses: CustomerStatus[] = ['active', 'active', 'active', 'active', 'inactive', 'blocked'];
  const kyc: KycStatus[] = ['verified', 'verified', 'verified', 'pending', 'rejected'];

  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const firstName = pick(rng, FIRST_NAMES);
    const lastName = pick(rng, LAST_NAMES);
    const [city, country] = pick(rng, CITIES);
    const createdAt = new Date(now - randomInt(rng, 5, 1200) * DAY_MS);

    customers.push({
      id: `cus_${padCode(i + 1, 4)}`,
      customerCode: `CUS-${padCode(i + 1, 5)}`,
      firstName,
      lastName,
      // Index-suffixed so no two generated customers collide on email.
      email: `${firstName.toLowerCase()}.${slug(lastName)}${i}@example.com`,
      phone: `+${randomInt(rng, 1, 99)} ${randomInt(rng, 200, 999)} ${randomInt(rng, 100000, 999999)}`,
      addressLine: `${randomInt(rng, 1, 240)} ${pick(rng, STREETS)}`,
      city,
      country,
      dateOfBirth: new Date(
        now - randomInt(rng, 21, 68) * 365 * DAY_MS - randomInt(rng, 0, 364) * DAY_MS,
      ).toISOString(),
      status: pick(rng, statuses),
      kycStatus: pick(rng, kyc),
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      createdAt: createdAt.toISOString(),
      updatedAt: new Date(createdAt.getTime() + randomInt(rng, 0, 60) * DAY_MS).toISOString(),
    });
  }

  return customers;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

function generateAccounts(rng: () => number, now: number, customers: Customer[]): Account[] {
  const accounts: Account[] = [];
  const types: AccountType[] = ['savings', 'checking', 'checking', 'fixed-deposit', 'business'];
  const currencies: Currency[] = ['USD', 'USD', 'USD', 'EUR', 'GBP', 'PKR'];
  let seq = 0;

  for (const customer of customers) {
    // Blocked customers still have accounts, but they are frozen.
    const count = customer.status === 'blocked' ? 1 : randomInt(rng, 1, 3);

    for (let i = 0; i < count; i++) {
      seq += 1;
      const type = pick(rng, types);
      const openedAt = new Date(
        new Date(customer.createdAt).getTime() + randomInt(rng, 0, 30) * DAY_MS,
      );

      let status: AccountStatus = 'active';
      if (customer.status === 'blocked') status = 'frozen';
      else if (customer.status === 'inactive') status = 'dormant';
      else if (rng() < 0.06) status = 'closed';

      accounts.push({
        id: `acc_${padCode(seq, 4)}`,
        accountNumber: `${randomInt(rng, 10, 99)}${padCode(seq, 6)}${randomInt(rng, 10, 99)}`,
        customerId: customer.id,
        type,
        status,
        currency: pick(rng, currencies),
        balance: status === 'closed' ? 0 : randomInt(rng, 12_000, 48_000_000),
        overdraftLimit: type === 'checking' || type === 'business' ? randomInt(rng, 0, 200_000) : 0,
        interestRate:
          type === 'fixed-deposit'
            ? Number((rng() * 3 + 3.5).toFixed(2))
            : type === 'savings'
              ? Number((rng() * 1.5 + 1).toFixed(2))
              : Number((rng() * 0.4).toFixed(2)),
        openedAt: openedAt.toISOString(),
        updatedAt: new Date(now - randomInt(rng, 0, 40) * DAY_MS).toISOString(),
      });
    }
  }

  return accounts;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const TRANSACTION_COUNT = 420;

function generateTransactions(
  rng: () => number,
  now: number,
  accounts: Account[],
  staff: Staff[],
): Transaction[] {
  // Only accounts that can actually move money.
  const usable = accounts.filter((a) => a.status === 'active' || a.status === 'dormant');
  if (usable.length === 0) return [];

  const transactions: Transaction[] = [];
  const types: TransactionType[] = [
    'deposit', 'deposit', 'withdrawal', 'withdrawal', 'transfer', 'transfer', 'transfer', 'fee',
  ];
  const statuses: TransactionStatus[] = [
    'completed', 'completed', 'completed', 'completed', 'completed',
    'completed', 'completed', 'pending', 'pending', 'failed', 'reversed',
  ];

  for (let i = 0; i < TRANSACTION_COUNT; i++) {
    const type = pick(rng, types);
    const status = pick(rng, statuses);
    const primary = pick(rng, usable);

    // Spread across ~180 days, weighted towards recent activity so the
    // dashboard trend charts have a realistic ramp.
    const daysAgo = Math.floor(Math.pow(rng(), 1.7) * 180);
    const createdAt = new Date(now - daysAgo * DAY_MS - randomInt(rng, 0, 86_399) * 1000);

    let fromAccountId: string | null = null;
    let toAccountId: string | null = null;

    if (type === 'deposit') {
      toAccountId = primary.id;
    } else if (type === 'withdrawal' || type === 'fee') {
      fromAccountId = primary.id;
    } else {
      fromAccountId = primary.id;
      // Pick a distinct counterparty in the same currency where possible.
      const candidates = usable.filter((a) => a.id !== primary.id && a.currency === primary.currency);
      const counterparty = candidates.length > 0 ? pick(rng, candidates) : null;
      if (!counterparty) {
        // Degenerate case (single account of this currency) — treat as a withdrawal.
        toAccountId = null;
      } else {
        toAccountId = counterparty.id;
      }
    }

    const amount =
      type === 'fee'
        ? randomInt(rng, 150, 4500)
        : randomInt(rng, 2_500, primary.balance > 500_000 ? 2_400_000 : 250_000);

    transactions.push({
      id: `txn_${padCode(i + 1, 5)}`,
      reference: `TX${createdAt.getFullYear()}${padCode(i + 1, 6)}`,
      type,
      status,
      amount,
      currency: primary.currency,
      fromAccountId,
      toAccountId,
      description: pick(rng, TRANSACTION_NOTES[type]),
      // Only settled transactions have a meaningful post-balance.
      balanceAfter: status === 'completed' ? primary.balance : null,
      createdAt: createdAt.toISOString(),
      createdByStaffId: pick(rng, staff).id,
    });
  }

  // Newest first — matches the default table ordering.
  return transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Service requests
// ---------------------------------------------------------------------------

const REQUEST_COUNT = 36;

function generateRequests(
  rng: () => number,
  now: number,
  customers: Customer[],
  staff: Staff[],
): ServiceRequest[] {
  const requests: ServiceRequest[] = [];
  const types: RequestType[] = [
    'new-account', 'card-issue', 'loan-application', 'cheque-book', 'dispute', 'account-closure',
  ];
  const statuses: RequestStatus[] = [
    'pending', 'pending', 'pending', 'processing', 'processing', 'completed', 'completed', 'rejected',
  ];
  const priorities: RequestPriority[] = ['low', 'normal', 'normal', 'normal', 'high', 'urgent'];

  for (let i = 0; i < REQUEST_COUNT; i++) {
    const customer = pick(rng, customers);
    const type = pick(rng, types);
    const status = pick(rng, statuses);
    const createdAt = new Date(now - randomInt(rng, 0, 90) * DAY_MS);
    const assignee = status === 'pending' && rng() < 0.4 ? null : pick(rng, staff);

    const timeline = buildTimeline(rng, createdAt, status, assignee?.id ?? 'stf_admin');
    const updatedAt = timeline[timeline.length - 1].at;

    requests.push({
      id: `req_${padCode(i + 1, 4)}`,
      ticket: `REQ-${padCode(i + 1, 5)}`,
      customerId: customer.id,
      type,
      status,
      priority: pick(rng, priorities),
      subject: REQUEST_SUBJECTS[type],
      details: REQUEST_DETAILS[type],
      assignedStaffId: assignee?.id ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt,
      timeline,
    });
  }

  return requests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Produces a plausible status history ending at `finalStatus`, so the timeline
 * on a completed request shows the pending → processing → completed path.
 */
function buildTimeline(
  rng: () => number,
  createdAt: Date,
  finalStatus: RequestStatus,
  staffId: string,
): RequestEvent[] {
  const events: RequestEvent[] = [
    {
      id: `evt_${createdAt.getTime()}_0`,
      status: 'pending',
      note: 'Request received and logged in the queue.',
      at: createdAt.toISOString(),
      byStaffId: staffId,
    },
  ];

  if (finalStatus === 'pending') return events;

  const processingAt = new Date(createdAt.getTime() + randomInt(rng, 2, 48) * 3_600_000);
  events.push({
    id: `evt_${createdAt.getTime()}_1`,
    status: 'processing',
    note: 'Assigned to an officer and under review.',
    at: processingAt.toISOString(),
    byStaffId: staffId,
  });

  if (finalStatus === 'processing') return events;

  const finalAt = new Date(processingAt.getTime() + randomInt(rng, 4, 96) * 3_600_000);
  events.push({
    id: `evt_${createdAt.getTime()}_2`,
    status: finalStatus,
    note:
      finalStatus === 'completed'
        ? 'Request fulfilled and the customer has been notified.'
        : 'Request rejected — supporting documentation was insufficient.',
    at: finalAt.toISOString(),
    byStaffId: staffId,
  });

  return events;
}

// ---------------------------------------------------------------------------
// Activity log & notifications
// ---------------------------------------------------------------------------

function generateActivity(
  rng: () => number,
  now: number,
  staff: Staff[],
  customers: Customer[],
  transactions: Transaction[],
): ActivityLog[] {
  const logs: ActivityLog[] = [];
  const templates: Array<{ action: string; entity: ActivityLog['entity'] }> = [
    { action: 'Signed in to the dashboard', entity: 'auth' },
    { action: 'Created a customer record', entity: 'customer' },
    { action: 'Updated customer KYC status', entity: 'customer' },
    { action: 'Opened a new account', entity: 'account' },
    { action: 'Processed a deposit', entity: 'transaction' },
    { action: 'Approved a service request', entity: 'request' },
    { action: 'Updated notification preferences', entity: 'settings' },
    { action: 'Froze an account pending review', entity: 'account' },
  ];

  for (let i = 0; i < 60; i++) {
    const template = pick(rng, templates);
    const entityId =
      template.entity === 'customer'
        ? pick(rng, customers).id
        : template.entity === 'transaction' && transactions.length > 0
          ? pick(rng, transactions).id
          : null;

    logs.push({
      id: `act_${padCode(i + 1, 4)}`,
      staffId: pick(rng, staff).id,
      action: template.action,
      entity: template.entity,
      entityId,
      at: new Date(now - randomInt(rng, 0, 20) * DAY_MS - randomInt(rng, 0, 86_399) * 1000).toISOString(),
    });
  }

  return logs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function generateNotifications(
  now: number,
  requests: ServiceRequest[],
  transactions: Transaction[],
): AppNotification[] {
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const pendingTx = transactions.filter((t) => t.status === 'pending').length;
  const failedTx = transactions.filter((t) => t.status === 'failed').length;

  return [
    {
      id: 'ntf_0001',
      title: 'Pending transactions need review',
      body: `${pendingTx} transactions are awaiting settlement approval.`,
      level: 'warning',
      read: false,
      at: new Date(now - 22 * 60_000).toISOString(),
    },
    {
      id: 'ntf_0002',
      title: 'New service requests',
      body: `${pendingRequests} customer requests are unassigned in the queue.`,
      level: 'info',
      read: false,
      at: new Date(now - 3 * 3_600_000).toISOString(),
    },
    {
      id: 'ntf_0003',
      title: 'Failed transaction alert',
      body: `${failedTx} transactions failed in the last 180 days and may need reconciliation.`,
      level: 'error',
      read: false,
      at: new Date(now - 9 * 3_600_000).toISOString(),
    },
    {
      id: 'ntf_0004',
      title: 'Monthly report ready',
      body: 'The consolidated performance report for last month is available in Reports.',
      level: 'success',
      read: true,
      at: new Date(now - 2 * DAY_MS).toISOString(),
    },
    {
      id: 'ntf_0005',
      title: 'Scheduled maintenance',
      body: 'Core banking services will be briefly unavailable this Sunday at 02:00 UTC.',
      level: 'info',
      read: true,
      at: new Date(now - 4 * DAY_MS).toISOString(),
    },
  ];
}

// ---------------------------------------------------------------------------

/** Lowercases and strips non-alphanumerics for use in generated emails. */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
