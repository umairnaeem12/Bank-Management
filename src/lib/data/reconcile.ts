/**
 * Balance reconciliation.
 *
 * Seed accounts and seed transactions are generated independently, which would
 * leave `account.balance` disagreeing with the sum of that account's ledger.
 * That inconsistency is invisible on a dashboard tile but obvious the moment
 * someone opens an account statement, so we replay the ledger once at seed
 * time and derive authoritative balances from it.
 *
 * The same replay function is reused by the transaction service to recompute
 * `balanceAfter` when a transaction is created, edited or reversed.
 */

import type { Account, Cents, Transaction } from '@/types';
import { groupBy } from '@/lib/algorithms/structures';

/** Only settled transactions move money. */
function isSettled(txn: Transaction): boolean {
  return txn.status === 'completed';
}

/** Signed effect of a transaction on a specific account, in minor units. */
export function effectOnAccount(txn: Transaction, accountId: string): Cents {
  if (!isSettled(txn)) return 0;

  let delta = 0;
  if (txn.toAccountId === accountId) delta += txn.amount;
  if (txn.fromAccountId === accountId) delta -= txn.amount;
  return delta;
}

/**
 * Replays every settled transaction against the supplied accounts and returns
 * accounts whose `balance` equals `openingBalance + net ledger movement`.
 *
 * Opening balances are chosen so that the *final* balance stays close to the
 * seeded figure — this keeps the headline "total deposits" number realistic
 * while making the statement arithmetic add up.
 */
export function reconcileBalances(
  accounts: Account[],
  transactions: Transaction[],
): { accounts: Account[]; transactions: Transaction[] } {
  // Chronological order — oldest first — so running balances accumulate correctly.
  const chronological = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const netByAccount = new Map<string, Cents>();
  for (const txn of chronological) {
    if (!isSettled(txn)) continue;
    if (txn.fromAccountId) {
      netByAccount.set(txn.fromAccountId, (netByAccount.get(txn.fromAccountId) ?? 0) - txn.amount);
    }
    if (txn.toAccountId) {
      netByAccount.set(txn.toAccountId, (netByAccount.get(txn.toAccountId) ?? 0) + txn.amount);
    }
  }

  // Opening balance = seeded closing balance - net movement, floored so an
  // account never starts life overdrawn beyond its limit.
  const openingBalances = new Map<string, Cents>();
  for (const account of accounts) {
    if (account.status === 'closed') {
      openingBalances.set(account.id, 0);
      continue;
    }
    const net = netByAccount.get(account.id) ?? 0;
    const opening = Math.max(account.overdraftLimit === 0 ? 0 : -account.overdraftLimit, account.balance - net);
    openingBalances.set(account.id, opening);
  }

  // Replay, stamping `balanceAfter` on each settled transaction.
  const running = new Map(openingBalances);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const replayed: Transaction[] = chronological.map((txn) => {
    if (!isSettled(txn)) return { ...txn, balanceAfter: null };

    // The "primary" account is the one whose statement this row anchors to:
    // the source for outgoing money, the destination for incoming.
    const primaryId = txn.fromAccountId ?? txn.toAccountId;
    if (!primaryId || !byId.has(primaryId)) return { ...txn, balanceAfter: null };

    if (txn.fromAccountId) {
      running.set(txn.fromAccountId, (running.get(txn.fromAccountId) ?? 0) - txn.amount);
    }
    if (txn.toAccountId) {
      running.set(txn.toAccountId, (running.get(txn.toAccountId) ?? 0) + txn.amount);
    }

    return { ...txn, balanceAfter: running.get(primaryId) ?? null };
  });

  const settledAccounts: Account[] = accounts.map((account) => {
    if (account.status === 'closed') return { ...account, balance: 0 };
    return { ...account, balance: running.get(account.id) ?? account.balance };
  });

  // Restore newest-first ordering for the UI.
  const restored = replayed.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { accounts: settledAccounts, transactions: restored };
}

/**
 * Recomputes `balanceAfter` for a single account's transactions.
 * Used after a mutation so a statement stays correct without a full reseed.
 */
export function recomputeStatement(
  accountId: string,
  openingBalance: Cents,
  transactions: readonly Transaction[],
): Transaction[] {
  const chronological = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let running = openingBalance;
  const out = chronological.map((txn) => {
    const delta = effectOnAccount(txn, accountId);
    if (delta === 0 && !isSettled(txn)) return { ...txn, balanceAfter: null };
    running += delta;
    return { ...txn, balanceAfter: running };
  });

  return out.reverse();
}

/** Groups transactions by the accounts they touch (both sides of a transfer). */
export function transactionsByAccount(
  transactions: readonly Transaction[],
): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();

  const add = (accountId: string, txn: Transaction) => {
    const bucket = map.get(accountId);
    if (bucket) bucket.push(txn);
    else map.set(accountId, [txn]);
  };

  for (const txn of transactions) {
    if (txn.fromAccountId) add(txn.fromAccountId, txn);
    // Guard against a self-transfer double-counting the same row.
    if (txn.toAccountId && txn.toAccountId !== txn.fromAccountId) add(txn.toAccountId, txn);
  }

  return map;
}

/** Convenience re-export so callers don't need two imports. */
export { groupBy };
