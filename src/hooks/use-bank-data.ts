'use client';

/**
 * Derived views over the bank store.
 *
 * These hooks own the joins and aggregations so components stay declarative.
 * Every one is memoised on the underlying collections, so a keystroke in a
 * search box doesn't recompute the dashboard.
 */

import { useMemo } from 'react';
import type {
  Account,
  Cents,
  Customer,
  ServiceRequest,
  Staff,
  Transaction,
} from '@/types';
import { useBankStore } from '@/store/use-bank-store';
import { IndexedCollection, countBy, groupBy, sumBy, PriorityQueue } from '@/lib/algorithms/structures';
import { topK } from '@/lib/algorithms/sorting';
import { transactionsByAccount } from '@/lib/data/reconcile';

/** O(1) lookup maps for the three most-joined collections. */
export function useLookups() {
  const customers = useBankStore((s) => s.customers);
  const accounts = useBankStore((s) => s.accounts);
  const staff = useBankStore((s) => s.staff);

  return useMemo(
    () => ({
      customerById: new IndexedCollection(customers, (c) => c.id),
      accountById: new IndexedCollection(accounts, (a) => a.id),
      staffById: new IndexedCollection(staff, (s) => s.id),
    }),
    [customers, accounts, staff],
  );
}

/** Accounts belonging to one customer. */
export function useCustomerAccounts(customerId: string | undefined): Account[] {
  const accounts = useBankStore((s) => s.accounts);

  return useMemo(() => {
    if (!customerId) return [];
    return accounts.filter((a) => a.customerId === customerId);
  }, [accounts, customerId]);
}

/** Every transaction touching any of the given accounts, newest first. */
export function useAccountTransactions(accountIds: string[]): Transaction[] {
  const transactions = useBankStore((s) => s.transactions);
  const key = accountIds.join(',');

  return useMemo(() => {
    if (accountIds.length === 0) return [];
    const wanted = new Set(accountIds);

    return transactions.filter(
      (t) =>
        (t.fromAccountId !== null && wanted.has(t.fromAccountId)) ||
        (t.toAccountId !== null && wanted.has(t.toAccountId)),
    );
    // `key` is the stable stand-in for the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, key]);
}

/** Index of accountId → its transactions, for statement views. */
export function useTransactionsByAccount(): Map<string, Transaction[]> {
  const transactions = useBankStore((s) => s.transactions);
  return useMemo(() => transactionsByAccount(transactions), [transactions]);
}

/** Requests filed by one customer. */
export function useCustomerRequests(customerId: string | undefined): ServiceRequest[] {
  const requests = useBankStore((s) => s.requests);

  return useMemo(() => {
    if (!customerId) return [];
    return requests.filter((r) => r.customerId === customerId);
  }, [requests, customerId]);
}

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalAccounts: number;
  activeAccounts: number;
  /** Sum of all active-account balances, in the base currency's minor units. */
  totalBalance: Cents;
  pendingTransactions: number;
  /** Transactions created in the last 30 days, any status. */
  recentTransactions: number;
  pendingRequests: number;
  staffCount: number;
  activeStaff: number;
  /** Settled deposit volume over the last 30 days. */
  monthlyInflow: Cents;
  monthlyOutflow: Cents;
  /** Percentage change in transaction count, last 30 days vs. the 30 before. */
  transactionTrend: number;
  customerTrend: number;
}

export function useDashboardStats(): DashboardStats {
  const customers = useBankStore((s) => s.customers);
  const accounts = useBankStore((s) => s.accounts);
  const transactions = useBankStore((s) => s.transactions);
  const requests = useBankStore((s) => s.requests);
  const staff = useBankStore((s) => s.staff);

  return useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    const last30 = now - 30 * day;
    const prev30 = now - 60 * day;

    let monthlyInflow = 0;
    let monthlyOutflow = 0;
    let recentCount = 0;
    let priorCount = 0;
    let pendingTransactions = 0;

    // Single pass — the transaction list is the largest collection, so this
    // avoids five separate filters over it.
    for (const txn of transactions) {
      if (txn.status === 'pending') pendingTransactions++;

      const at = new Date(txn.createdAt).getTime();
      if (at >= last30) {
        recentCount++;
        if (txn.status === 'completed') {
          if (txn.type === 'deposit') monthlyInflow += txn.amount;
          else if (txn.type === 'withdrawal' || txn.type === 'fee') monthlyOutflow += txn.amount;
        }
      } else if (at >= prev30) {
        priorCount++;
      }
    }

    const recentCustomers = customers.filter((c) => new Date(c.createdAt).getTime() >= last30).length;
    const priorCustomers = customers.filter((c) => {
      const at = new Date(c.createdAt).getTime();
      return at >= prev30 && at < last30;
    }).length;

    return {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.status === 'active').length,
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === 'active').length,
      totalBalance: sumBy(
        accounts.filter((a) => a.status !== 'closed'),
        (a) => a.balance,
      ),
      pendingTransactions,
      recentTransactions: recentCount,
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      staffCount: staff.length,
      activeStaff: staff.filter((s) => s.status === 'active').length,
      monthlyInflow,
      monthlyOutflow,
      transactionTrend: percentChange(recentCount, priorCount),
      customerTrend: percentChange(recentCustomers, priorCustomers),
    };
  }, [customers, accounts, transactions, requests, staff]);
}

/** Guards the divide-by-zero case so a first-ever month reads as +100%, not NaN. */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Chart series
// ---------------------------------------------------------------------------

export interface MonthlyPoint {
  month: string;
  deposits: number;
  withdrawals: number;
  transfers: number;
  net: number;
}

/** Twelve-month inflow/outflow series for the dashboard area chart. */
export function useMonthlySeries(months = 12): MonthlyPoint[] {
  const transactions = useBankStore((s) => s.transactions);

  return useMemo(() => {
    const now = new Date();
    const buckets = new Map<string, MonthlyPoint>();

    // Pre-seed every month so gaps render as zero rather than collapsing the axis.
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, {
        month: d.toLocaleString('en-US', { month: 'short' }),
        deposits: 0,
        withdrawals: 0,
        transfers: 0,
        net: 0,
      });
    }

    for (const txn of transactions) {
      if (txn.status !== 'completed') continue;

      const d = new Date(txn.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue; // Older than the window.

      const major = txn.amount / 100;
      if (txn.type === 'deposit') {
        bucket.deposits += major;
        bucket.net += major;
      } else if (txn.type === 'withdrawal' || txn.type === 'fee') {
        bucket.withdrawals += major;
        bucket.net -= major;
      } else {
        bucket.transfers += major;
      }
    }

    return [...buckets.values()].map((b) => ({
      ...b,
      deposits: Math.round(b.deposits),
      withdrawals: Math.round(b.withdrawals),
      transfers: Math.round(b.transfers),
      net: Math.round(b.net),
    }));
  }, [transactions, months]);
}

export interface CategoryPoint {
  name: string;
  value: number;
}

/** Account distribution by type, for the donut chart. */
export function useAccountTypeBreakdown(): CategoryPoint[] {
  const accounts = useBankStore((s) => s.accounts);

  return useMemo(() => {
    const counts = countBy(
      accounts.filter((a) => a.status !== 'closed'),
      (a) => a.type,
    );
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [accounts]);
}

/** Balance held per account type — where the money actually sits. */
export function useBalanceByType(): CategoryPoint[] {
  const accounts = useBankStore((s) => s.accounts);

  return useMemo(() => {
    const groups = groupBy(
      accounts.filter((a) => a.status !== 'closed'),
      (a) => a.type,
    );
    return [...groups.entries()].map(([name, group]) => ({
      name,
      value: Math.round(sumBy(group, (a) => a.balance) / 100),
    }));
  }, [accounts]);
}

export function useRequestStatusBreakdown(): CategoryPoint[] {
  const requests = useBankStore((s) => s.requests);

  return useMemo(() => {
    const counts = countBy(requests, (r) => r.status);
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [requests]);
}

/** Top accounts by balance — uses a partial sort rather than ordering all of them. */
export function useTopAccounts(limit = 5): Array<{ account: Account; customer: Customer | undefined }> {
  const accounts = useBankStore((s) => s.accounts);
  const customers = useBankStore((s) => s.customers);

  return useMemo(() => {
    const index = new IndexedCollection(customers, (c) => c.id);
    const top = topK(
      accounts.filter((a) => a.status !== 'closed'),
      limit,
      (a, b) => b.balance - a.balance,
    );
    return top.map((account) => ({ account, customer: index.get(account.customerId) }));
  }, [accounts, customers, limit]);
}

/** Most recent transactions, already joined to their accounts and customers. */
export function useRecentTransactions(limit = 6) {
  const transactions = useBankStore((s) => s.transactions);
  const { accountById, customerById } = useLookups();

  return useMemo(() => {
    return transactions.slice(0, limit).map((txn) => {
      const account = accountById.get(txn.fromAccountId ?? txn.toAccountId);
      const customer = account ? customerById.get(account.customerId) : undefined;
      return { transaction: txn, account, customer };
    });
  }, [transactions, limit, accountById, customerById]);
}

// ---------------------------------------------------------------------------
// Request processing queue
// ---------------------------------------------------------------------------

const PRIORITY_WEIGHT: Record<ServiceRequest['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Open requests ordered the way a service desk would actually work them:
 * highest priority first, oldest first within a priority band.
 *
 * Backed by a min-heap so inserting a new urgent ticket is O(log n) rather
 * than re-sorting the whole queue.
 */
export function useRequestQueue(): ServiceRequest[] {
  const requests = useBankStore((s) => s.requests);

  return useMemo(() => {
    const queue = new PriorityQueue<ServiceRequest>((a, b) => {
      const weight = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (weight !== 0) return weight;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const request of requests) {
      if (request.status === 'pending' || request.status === 'processing') queue.push(request);
    }

    return queue.drain();
  }, [requests]);
}

/** Staff joined with their assigned-request counts, for the staff table. */
export function useStaffWithWorkload(): Array<Staff & { openRequests: number }> {
  const staff = useBankStore((s) => s.staff);
  const requests = useBankStore((s) => s.requests);

  return useMemo(() => {
    const open = new Map<string, number>();
    for (const r of requests) {
      if (r.status !== 'pending' && r.status !== 'processing') continue;
      if (!r.assignedStaffId) continue;
      open.set(r.assignedStaffId, (open.get(r.assignedStaffId) ?? 0) + 1);
    }
    return staff.map((s) => ({ ...s, openRequests: open.get(s.id) ?? 0 }));
  }, [staff, requests]);
}
