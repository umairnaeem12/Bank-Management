'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown } from 'lucide-react';
import type { Account, Customer } from '@/types';
import type { MoneyResult } from '@/store/use-bank-store';
import { IndexedCollection } from '@/lib/algorithms/structures';
import { formatCurrency, fullName, maskAccountNumber, toMinor, titleCase } from '@/lib/utils/format';
import { positiveAmount } from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export function TransferForm({
  open,
  onClose,
  accounts,
  customers,
  onSubmit,
  /** Pre-selects the source account when launched from an account page. */
  defaultFromId,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  customers: Customer[];
  onSubmit: (fromId: string, toId: string, amountMinor: number, description: string) => MoneyResult;
  defaultFromId?: string;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const customerIndex = useMemo(
    () => new IndexedCollection(customers, (c) => c.id),
    [customers],
  );

  // Only active accounts can send or receive.
  const transferable = useMemo(
    () => accounts.filter((a) => a.status === 'active'),
    [accounts],
  );

  const from = transferable.find((a) => a.id === fromId);

  // Cross-currency movement isn't modelled, so the destination list is limited
  // to the source's currency — better than letting the user pick and fail.
  const destinations = useMemo(() => {
    if (!from) return [];
    return transferable.filter((a) => a.id !== from.id && a.currency === from.currency);
  }, [transferable, from]);

  useEffect(() => {
    if (!open) return;

    const initialFrom = defaultFromId ?? transferable[0]?.id ?? '';
    setFromId(initialFrom);
    setToId('');
    setAmount('');
    setDescription('');
    setAmountError(null);
    setFailure(null);
  }, [open, defaultFromId, transferable]);

  // Clear a destination that is no longer valid after the source changes.
  useEffect(() => {
    if (toId && !destinations.some((a) => a.id === toId)) setToId('');
  }, [destinations, toId]);

  const label = (account: Account) => {
    const owner = customerIndex.get(account.customerId);
    return `${maskAccountNumber(account.accountNumber)} · ${owner ? fullName(owner) : 'Unknown'} · ${formatCurrency(account.balance, account.currency)}`;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    if (!fromId || !toId) {
      setFailure('Select both a source and a destination account.');
      return;
    }

    const error = positiveAmount('Amount')(amount);
    if (error) {
      setAmountError(error);
      return;
    }
    setAmountError(null);

    const minor = toMinor(amount);
    if (from && minor > from.balance + from.overdraftLimit) {
      setAmountError('Amount exceeds the available balance and overdraft.');
      return;
    }

    const result = onSubmit(fromId, toId, minor, description.trim());
    if (!result.ok) setFailure(result.error);
  };

  const to = destinations.find((a) => a.id === toId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New transfer"
      description="Move funds between two active accounts held in the same currency."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={transferable.length < 2}>
            Transfer funds
          </Button>
        </>
      }
    >
      {transferable.length < 2 ? (
        <p className="py-6 text-center text-sm text-muted-text">
          At least two active accounts are needed to make a transfer.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Select
            label="From account"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            options={transferable.map((a) => ({ value: a.id, label: label(a) }))}
            required
          />

          <div className="flex justify-center" aria-hidden>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken text-muted-text">
              <ArrowDown className="h-4 w-4" />
            </span>
          </div>

          <Select
            label="To account"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            options={[
              {
                value: '',
                label:
                  destinations.length === 0
                    ? `No other active ${from?.currency ?? ''} accounts`
                    : 'Select a destination…',
              },
              ...destinations.map((a) => ({ value: a.id, label: label(a) })),
            ]}
            hint={
              from
                ? `Only active ${from.currency} accounts are listed — cross-currency transfers are not supported yet.`
                : undefined
            }
            required
          />

          <Input
            label={`Amount (${from?.currency ?? 'USD'})`}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountError}
            required
          />

          <Textarea
            label="Description"
            placeholder="Rent payment"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            hint="Optional — shown on both statements."
          />

          {/* Live preview of the resulting balances. */}
          {from && to && amount && !amountError && (
            <div className="rounded-lg bg-surface-sunken px-4 py-3 text-xs">
              <p className="mb-2 font-medium text-primary-text">After this transfer</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-text">
                  {maskAccountNumber(from.accountNumber)} ({titleCase(from.type)})
                </span>
                <span className="font-medium text-primary-text tabular">
                  {formatCurrency(from.balance - toMinor(amount), from.currency)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-text">
                  {maskAccountNumber(to.accountNumber)} ({titleCase(to.type)})
                </span>
                <span className="font-medium text-primary-text tabular">
                  {formatCurrency(to.balance + toMinor(amount), to.currency)}
                </span>
              </div>
            </div>
          )}

          {failure && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {failure}
            </div>
          )}

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
