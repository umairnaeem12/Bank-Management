'use client';

/**
 * The application data store.
 *
 * One store holds every collection because the modules are heavily
 * cross-referential (a transfer touches two accounts, a customer, and writes
 * an activity log). Splitting them would mean coordinating writes across
 * stores for what is logically a single transaction.
 *
 * Persistence is manual rather than via zustand's `persist` middleware: we
 * only want to write the collections, and we need an explicit `hydrate()` step
 * so the server render and the first client render agree (see `useHydrated`).
 */

import { create } from 'zustand';
import type {
  Account,
  ActivityEntity,
  ActivityLog,
  AppNotification,
  AppSettings,
  Cents,
  Customer,
  RequestStatus,
  ServiceRequest,
  Staff,
  Transaction,
} from '@/types';
import { STORAGE_KEYS, readStorage, writeStorage, clearAppStorage } from '@/lib/storage/local-storage';
import { generateSeedData, SEED_VERSION } from '@/lib/data/seed';
import { reconcileBalances } from '@/lib/data/reconcile';
import { createId, padCode } from '@/lib/utils/id';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  baseCurrency: 'USD',
  dateFormat: 'us',
  density: 'comfortable',
  notifications: {
    transactionAlerts: true,
    requestUpdates: true,
    weeklyDigest: false,
    productNews: false,
  },
};

/** Result type for money operations, so callers can surface a precise reason. */
export type MoneyResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string };

interface BankState {
  // --- data ---
  customers: Customer[];
  accounts: Account[];
  transactions: Transaction[];
  requests: ServiceRequest[];
  staff: Staff[];
  activity: ActivityLog[];
  notifications: AppNotification[];
  settings: AppSettings;

  /** False until `hydrate()` has run on the client. Gates skeleton rendering. */
  hydrated: boolean;

  // --- lifecycle ---
  hydrate: () => void;
  resetDemoData: () => void;

  // --- customers ---
  addCustomer: (input: CustomerInput, actorId: string) => Customer;
  updateCustomer: (id: string, patch: Partial<CustomerInput>, actorId: string) => void;
  deleteCustomer: (id: string, actorId: string) => void;

  // --- accounts ---
  addAccount: (input: AccountInput, actorId: string) => Account;
  updateAccount: (id: string, patch: Partial<AccountInput>, actorId: string) => void;
  closeAccount: (id: string, actorId: string) => void;

  // --- money movement ---
  deposit: (accountId: string, amount: Cents, description: string, actorId: string) => MoneyResult;
  withdraw: (accountId: string, amount: Cents, description: string, actorId: string) => MoneyResult;
  transfer: (
    fromAccountId: string,
    toAccountId: string,
    amount: Cents,
    description: string,
    actorId: string,
  ) => MoneyResult;
  setTransactionStatus: (id: string, status: Transaction['status'], actorId: string) => void;

  // --- requests ---
  addRequest: (input: RequestInput, actorId: string) => ServiceRequest;
  updateRequestStatus: (id: string, status: RequestStatus, note: string, actorId: string) => void;
  assignRequest: (id: string, staffId: string | null, actorId: string) => void;

  // --- staff ---
  addStaff: (input: StaffInput, actorId: string) => Staff;
  updateStaff: (id: string, patch: Partial<StaffInput>, actorId: string) => void;
  deleteStaff: (id: string, actorId: string) => void;

  // --- notifications & settings ---
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export type CustomerInput = Omit<Customer, 'id' | 'customerCode' | 'createdAt' | 'updatedAt' | 'avatarColor'>;
export type AccountInput = Omit<Account, 'id' | 'accountNumber' | 'openedAt' | 'updatedAt'>;
export type StaffInput = Omit<Staff, 'id' | 'employeeCode' | 'joinedAt' | 'lastActiveAt' | 'avatarColor'>;
export type RequestInput = Omit<
  ServiceRequest,
  'id' | 'ticket' | 'createdAt' | 'updatedAt' | 'timeline' | 'status'
>;

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ea580c',
  '#4f46e5', '#0891b2', '#c026d3', '#059669', '#e11d48',
];

/** Deterministic colour from an id, so avatars don't flicker between renders. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const useBankStore = create<BankState>((set, get) => ({
  customers: [],
  accounts: [],
  transactions: [],
  requests: [],
  staff: [],
  activity: [],
  notifications: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  hydrate: () => {
    if (get().hydrated) return;

    const storedVersion = readStorage<number>(STORAGE_KEYS.seedVersion, 0);
    const settings = readStorage<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

    // A version bump means the generated shape changed — reseed rather than
    // merge, since partial old data would break the new views.
    if (storedVersion !== SEED_VERSION) {
      const seeded = seedFresh();
      set({ ...seeded, settings: { ...DEFAULT_SETTINGS, ...settings }, hydrated: true });
      return;
    }

    set({
      customers: readStorage<Customer[]>(STORAGE_KEYS.customers, []),
      accounts: readStorage<Account[]>(STORAGE_KEYS.accounts, []),
      transactions: readStorage<Transaction[]>(STORAGE_KEYS.transactions, []),
      requests: readStorage<ServiceRequest[]>(STORAGE_KEYS.requests, []),
      staff: readStorage<Staff[]>(STORAGE_KEYS.staff, []),
      activity: readStorage<ActivityLog[]>(STORAGE_KEYS.activity, []),
      notifications: readStorage<AppNotification[]>(STORAGE_KEYS.notifications, []),
      settings: { ...DEFAULT_SETTINGS, ...settings },
      hydrated: true,
    });
  },

  resetDemoData: () => {
    clearAppStorage();
    const seeded = seedFresh();
    set({ ...seeded, settings: DEFAULT_SETTINGS, hydrated: true });
    writeStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  },

  // -------------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------------

  addCustomer: (input, actorId) => {
    const now = new Date().toISOString();
    const id = createId('cus');

    const customer: Customer = {
      ...input,
      id,
      customerCode: `CUS-${padCode(get().customers.length + 1, 5)}`,
      avatarColor: colorFor(id),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const customers = [customer, ...state.customers];
      writeStorage(STORAGE_KEYS.customers, customers);
      return { customers, activity: log(state, actorId, 'Created a customer record', 'customer', id) };
    });

    return customer;
  },

  updateCustomer: (id, patch, actorId) => {
    set((state) => {
      const customers = state.customers.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      );
      writeStorage(STORAGE_KEYS.customers, customers);
      return { customers, activity: log(state, actorId, 'Updated a customer record', 'customer', id) };
    });
  },

  deleteCustomer: (id, actorId) => {
    set((state) => {
      const customers = state.customers.filter((c) => c.id !== id);
      // Cascade: a customer's accounts must not outlive them, or the accounts
      // list would render rows with an unresolvable owner.
      const removedAccountIds = new Set(
        state.accounts.filter((a) => a.customerId === id).map((a) => a.id),
      );
      const accounts = state.accounts.filter((a) => a.customerId !== id);
      const transactions = state.transactions.filter(
        (t) =>
          !(t.fromAccountId && removedAccountIds.has(t.fromAccountId)) &&
          !(t.toAccountId && removedAccountIds.has(t.toAccountId)),
      );
      const requests = state.requests.filter((r) => r.customerId !== id);

      writeStorage(STORAGE_KEYS.customers, customers);
      writeStorage(STORAGE_KEYS.accounts, accounts);
      writeStorage(STORAGE_KEYS.transactions, transactions);
      writeStorage(STORAGE_KEYS.requests, requests);

      return {
        customers,
        accounts,
        transactions,
        requests,
        activity: log(state, actorId, 'Deleted a customer record', 'customer', id),
      };
    });
  },

  // -------------------------------------------------------------------------
  // Accounts
  // -------------------------------------------------------------------------

  addAccount: (input, actorId) => {
    const now = new Date().toISOString();
    const id = createId('acc');
    const seq = get().accounts.length + 1;

    const account: Account = {
      ...input,
      id,
      accountNumber: `${padCode(seq, 8)}${padCode((seq * 7) % 100, 2)}`,
      openedAt: now,
      updatedAt: now,
    };

    set((state) => {
      const accounts = [account, ...state.accounts];
      writeStorage(STORAGE_KEYS.accounts, accounts);
      return { accounts, activity: log(state, actorId, 'Opened a new account', 'account', id) };
    });

    // An opening deposit is a real ledger movement, not a starting field.
    if (input.balance > 0) {
      const opening: Transaction = {
        id: createId('txn'),
        reference: `TX${new Date().getFullYear()}${padCode(get().transactions.length + 1, 6)}`,
        type: 'deposit',
        status: 'completed',
        amount: input.balance,
        currency: input.currency,
        fromAccountId: null,
        toAccountId: id,
        description: 'Opening deposit',
        balanceAfter: input.balance,
        createdAt: now,
        createdByStaffId: actorId,
      };

      set((state) => {
        const transactions = [opening, ...state.transactions];
        writeStorage(STORAGE_KEYS.transactions, transactions);
        return { transactions };
      });
    }

    return account;
  },

  updateAccount: (id, patch, actorId) => {
    set((state) => {
      const accounts = state.accounts.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
      );
      writeStorage(STORAGE_KEYS.accounts, accounts);
      return { accounts, activity: log(state, actorId, 'Updated account details', 'account', id) };
    });
  },

  closeAccount: (id, actorId) => {
    set((state) => {
      const accounts = state.accounts.map((a) =>
        a.id === id
          ? { ...a, status: 'closed' as const, balance: 0, updatedAt: new Date().toISOString() }
          : a,
      );
      writeStorage(STORAGE_KEYS.accounts, accounts);
      return { accounts, activity: log(state, actorId, 'Closed an account', 'account', id) };
    });
  },

  // -------------------------------------------------------------------------
  // Money movement
  //
  // All three operations funnel through `commit`, which is the single place
  // that mutates a balance and appends to the ledger. Keeping it in one
  // function is what makes the invariant "balance always equals replayed
  // ledger" enforceable.
  // -------------------------------------------------------------------------

  deposit: (accountId, amount, description, actorId) => {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    if (account.status !== 'active') {
      return { ok: false, error: `Cannot deposit into a ${account.status} account.` };
    }
    if (amount <= 0) return { ok: false, error: 'Amount must be greater than zero.' };

    return commit(set, get, {
      type: 'deposit',
      amount,
      currency: account.currency,
      fromAccountId: null,
      toAccountId: accountId,
      description: description || 'Deposit',
      actorId,
      primaryAccountId: accountId,
    });
  },

  withdraw: (accountId, amount, description, actorId) => {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    if (account.status !== 'active') {
      return { ok: false, error: `Cannot withdraw from a ${account.status} account.` };
    }
    if (amount <= 0) return { ok: false, error: 'Amount must be greater than zero.' };

    const available = account.balance + account.overdraftLimit;
    if (amount > available) {
      return { ok: false, error: 'Insufficient funds, including any overdraft allowance.' };
    }

    return commit(set, get, {
      type: 'withdrawal',
      amount,
      currency: account.currency,
      fromAccountId: accountId,
      toAccountId: null,
      description: description || 'Withdrawal',
      actorId,
      primaryAccountId: accountId,
    });
  },

  transfer: (fromAccountId, toAccountId, amount, description, actorId) => {
    if (fromAccountId === toAccountId) {
      return { ok: false, error: 'Source and destination accounts must differ.' };
    }

    const accounts = get().accounts;
    const from = accounts.find((a) => a.id === fromAccountId);
    const to = accounts.find((a) => a.id === toAccountId);

    if (!from || !to) return { ok: false, error: 'One or both accounts could not be found.' };
    if (from.status !== 'active') return { ok: false, error: `Source account is ${from.status}.` };
    if (to.status !== 'active') return { ok: false, error: `Destination account is ${to.status}.` };
    if (amount <= 0) return { ok: false, error: 'Amount must be greater than zero.' };

    // Cross-currency movement needs an FX rate the MVP doesn't model; blocking
    // it is better than silently transferring the wrong value.
    if (from.currency !== to.currency) {
      return {
        ok: false,
        error: `Cross-currency transfers (${from.currency} → ${to.currency}) are not supported yet.`,
      };
    }

    const available = from.balance + from.overdraftLimit;
    if (amount > available) {
      return { ok: false, error: 'Insufficient funds, including any overdraft allowance.' };
    }

    return commit(set, get, {
      type: 'transfer',
      amount,
      currency: from.currency,
      fromAccountId,
      toAccountId,
      description: description || 'Transfer',
      actorId,
      primaryAccountId: fromAccountId,
    });
  },

  /**
   * Moves a transaction between statuses, applying or unwinding its balance
   * effect. Settling a pending transfer debits the source; reversing a
   * completed one credits it back.
   */
  setTransactionStatus: (id, status, actorId) => {
    set((state) => {
      const txn = state.transactions.find((t) => t.id === id);
      if (!txn || txn.status === status) return {};

      const wasSettled = txn.status === 'completed';
      const willSettle = status === 'completed';

      let accounts = state.accounts;

      // Only a transition across the settled boundary moves money.
      if (wasSettled !== willSettle) {
        const sign = willSettle ? 1 : -1;
        accounts = state.accounts.map((account) => {
          let delta = 0;
          if (txn.toAccountId === account.id) delta += txn.amount * sign;
          if (txn.fromAccountId === account.id) delta -= txn.amount * sign;
          return delta === 0
            ? account
            : { ...account, balance: account.balance + delta, updatedAt: new Date().toISOString() };
        });
      }

      const primaryId = txn.fromAccountId ?? txn.toAccountId;
      const primary = accounts.find((a) => a.id === primaryId);

      const transactions = state.transactions.map((t) =>
        t.id === id
          ? { ...t, status, balanceAfter: willSettle ? (primary?.balance ?? null) : null }
          : t,
      );

      writeStorage(STORAGE_KEYS.accounts, accounts);
      writeStorage(STORAGE_KEYS.transactions, transactions);

      return {
        accounts,
        transactions,
        activity: log(state, actorId, `Marked a transaction as ${status}`, 'transaction', id),
      };
    });
  },

  // -------------------------------------------------------------------------
  // Service requests
  // -------------------------------------------------------------------------

  addRequest: (input, actorId) => {
    const now = new Date().toISOString();
    const id = createId('req');

    const request: ServiceRequest = {
      ...input,
      id,
      ticket: `REQ-${padCode(get().requests.length + 1, 5)}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          id: createId('evt'),
          status: 'pending',
          note: 'Request received and logged in the queue.',
          at: now,
          byStaffId: actorId,
        },
      ],
    };

    set((state) => {
      const requests = [request, ...state.requests];
      writeStorage(STORAGE_KEYS.requests, requests);
      return { requests, activity: log(state, actorId, 'Logged a service request', 'request', id) };
    });

    return request;
  },

  updateRequestStatus: (id, status, note, actorId) => {
    set((state) => {
      const now = new Date().toISOString();
      const requests = state.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              updatedAt: now,
              timeline: [
                ...r.timeline,
                {
                  id: createId('evt'),
                  status,
                  note: note || `Status changed to ${status}.`,
                  at: now,
                  byStaffId: actorId,
                },
              ],
            }
          : r,
      );
      writeStorage(STORAGE_KEYS.requests, requests);
      return {
        requests,
        activity: log(state, actorId, `Moved a request to ${status}`, 'request', id),
      };
    });
  },

  assignRequest: (id, staffId, actorId) => {
    set((state) => {
      const requests = state.requests.map((r) =>
        r.id === id ? { ...r, assignedStaffId: staffId, updatedAt: new Date().toISOString() } : r,
      );
      writeStorage(STORAGE_KEYS.requests, requests);
      return { requests, activity: log(state, actorId, 'Reassigned a request', 'request', id) };
    });
  },

  // -------------------------------------------------------------------------
  // Staff
  // -------------------------------------------------------------------------

  addStaff: (input, actorId) => {
    const now = new Date().toISOString();
    const id = createId('stf');

    const member: Staff = {
      ...input,
      id,
      employeeCode: `EMP-${padCode(get().staff.length + 1, 4)}`,
      avatarColor: colorFor(id),
      joinedAt: now,
      lastActiveAt: now,
    };

    set((state) => {
      const staff = [member, ...state.staff];
      writeStorage(STORAGE_KEYS.staff, staff);
      return { staff, activity: log(state, actorId, 'Added a staff member', 'staff', id) };
    });

    return member;
  },

  updateStaff: (id, patch, actorId) => {
    set((state) => {
      const staff = state.staff.map((s) => (s.id === id ? { ...s, ...patch } : s));
      writeStorage(STORAGE_KEYS.staff, staff);
      return { staff, activity: log(state, actorId, 'Updated a staff record', 'staff', id) };
    });
  },

  deleteStaff: (id, actorId) => {
    set((state) => {
      const staff = state.staff.filter((s) => s.id !== id);
      // Unassign rather than cascade — the request itself is still valid work.
      const requests = state.requests.map((r) =>
        r.assignedStaffId === id ? { ...r, assignedStaffId: null } : r,
      );
      writeStorage(STORAGE_KEYS.staff, staff);
      writeStorage(STORAGE_KEYS.requests, requests);
      return { staff, requests, activity: log(state, actorId, 'Removed a staff member', 'staff', id) };
    });
  },

  // -------------------------------------------------------------------------
  // Notifications & settings
  // -------------------------------------------------------------------------

  markNotificationRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeStorage(STORAGE_KEYS.notifications, notifications);
      return { notifications };
    });
  },

  markAllNotificationsRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }));
      writeStorage(STORAGE_KEYS.notifications, notifications);
      return { notifications };
    });
  },

  dismissNotification: (id) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      writeStorage(STORAGE_KEYS.notifications, notifications);
      return { notifications };
    });
  },

  updateSettings: (patch) => {
    set((state) => {
      const settings: AppSettings = {
        ...state.settings,
        ...patch,
        notifications: { ...state.settings.notifications, ...(patch.notifications ?? {}) },
      };
      writeStorage(STORAGE_KEYS.settings, settings);
      return { settings };
    });
  },
}));

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface CommitInput {
  type: Transaction['type'];
  amount: Cents;
  currency: Transaction['currency'];
  fromAccountId: string | null;
  toAccountId: string | null;
  description: string;
  actorId: string;
  primaryAccountId: string;
}

/**
 * Applies a settled money movement: adjusts both sides of the ledger, appends
 * the transaction, and persists. Returns the created transaction so the caller
 * can show a reference number in a toast.
 */
function commit(
  set: (fn: (state: BankState) => Partial<BankState>) => void,
  get: () => BankState,
  input: CommitInput,
): MoneyResult {
  const now = new Date().toISOString();
  const state = get();

  const accounts = state.accounts.map((account) => {
    let delta = 0;
    if (input.toAccountId === account.id) delta += input.amount;
    if (input.fromAccountId === account.id) delta -= input.amount;
    return delta === 0 ? account : { ...account, balance: account.balance + delta, updatedAt: now };
  });

  const primary = accounts.find((a) => a.id === input.primaryAccountId);

  const transaction: Transaction = {
    id: createId('txn'),
    reference: `TX${new Date().getFullYear()}${padCode(state.transactions.length + 1, 6)}`,
    type: input.type,
    status: 'completed',
    amount: input.amount,
    currency: input.currency,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    description: input.description,
    balanceAfter: primary?.balance ?? null,
    createdAt: now,
    createdByStaffId: input.actorId,
  };

  set((current) => {
    const transactions = [transaction, ...current.transactions];
    writeStorage(STORAGE_KEYS.accounts, accounts);
    writeStorage(STORAGE_KEYS.transactions, transactions);
    return {
      accounts,
      transactions,
      activity: log(current, input.actorId, `Processed a ${input.type}`, 'transaction', transaction.id),
    };
  });

  return { ok: true, transaction };
}

/** Appends an activity entry, capping the log so LocalStorage can't grow unbounded. */
function log(
  state: BankState,
  staffId: string,
  action: string,
  entity: ActivityEntity,
  entityId: string | null,
): ActivityLog[] {
  const entry: ActivityLog = {
    id: createId('act'),
    staffId,
    action,
    entity,
    entityId,
    at: new Date().toISOString(),
  };

  const activity = [entry, ...state.activity].slice(0, 200);
  writeStorage(STORAGE_KEYS.activity, activity);
  return activity;
}

/** Generates, reconciles and persists a fresh demo dataset. */
function seedFresh() {
  const seed = generateSeedData(Date.now());
  const { accounts, transactions } = reconcileBalances(seed.accounts, seed.transactions);

  writeStorage(STORAGE_KEYS.customers, seed.customers);
  writeStorage(STORAGE_KEYS.accounts, accounts);
  writeStorage(STORAGE_KEYS.transactions, transactions);
  writeStorage(STORAGE_KEYS.requests, seed.requests);
  writeStorage(STORAGE_KEYS.staff, seed.staff);
  writeStorage(STORAGE_KEYS.activity, seed.activity);
  writeStorage(STORAGE_KEYS.notifications, seed.notifications);
  writeStorage(STORAGE_KEYS.seedVersion, SEED_VERSION);

  return {
    customers: seed.customers,
    accounts,
    transactions,
    requests: seed.requests,
    staff: seed.staff,
    activity: seed.activity,
    notifications: seed.notifications,
  };
}
