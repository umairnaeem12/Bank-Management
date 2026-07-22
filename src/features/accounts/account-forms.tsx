'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Account, AccountStatus, AccountType, Currency, Customer } from '@/types';
import type { AccountInput, MoneyResult } from '@/store/use-bank-store';
import { formatCurrency, fullName, maskAccountNumber, toMinor, titleCase } from '@/lib/utils/format';
import { positiveAmount, required, validate, type ValidationErrors } from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'savings', label: 'Savings' },
  { value: 'checking', label: 'Checking' },
  { value: 'fixed-deposit', label: 'Fixed Deposit' },
  { value: 'business', label: 'Business' },
];

const STATUS_OPTIONS: Array<{ value: AccountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'frozen', label: 'Frozen' },
];

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
];

// ---------------------------------------------------------------------------
// Open / edit account
// ---------------------------------------------------------------------------

interface AccountFormState {
  customerId: string;
  type: AccountType;
  status: AccountStatus;
  currency: Currency;
  /** Major units as typed; converted to cents on submit. */
  openingBalance: string;
  overdraftLimit: string;
  interestRate: string;
}

const EMPTY: AccountFormState = {
  customerId: '',
  type: 'savings',
  status: 'active',
  currency: 'USD',
  openingBalance: '',
  overdraftLimit: '0',
  interestRate: '1.5',
};

export function AccountForm({
  open,
  onClose,
  onSubmit,
  customers,
  account,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AccountInput) => void;
  customers: Customer[];
  account?: Account | null;
}) {
  const [values, setValues] = useState<AccountFormState>(EMPTY);
  const [errors, setErrors] = useState<ValidationErrors<AccountFormState>>({});

  // Only customers who can actually hold an account.
  const eligible = useMemo(
    () => customers.filter((c) => c.status !== 'blocked'),
    [customers],
  );

  useEffect(() => {
    if (!open) return;

    if (account) {
      setValues({
        customerId: account.customerId,
        type: account.type,
        status: account.status === 'closed' ? 'dormant' : account.status,
        currency: account.currency,
        openingBalance: String(account.balance / 100),
        overdraftLimit: String(account.overdraftLimit / 100),
        interestRate: String(account.interestRate),
      });
    } else {
      setValues({ ...EMPTY, customerId: eligible[0]?.id ?? '' });
    }
    setErrors({});
  }, [open, account, eligible]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      customerId: required('Customer'),
      // An opening balance of zero is legitimate, so only validate when present.
      openingBalance: (value) =>
        account || value.trim() === '' ? null : positiveAmount('Opening balance')(value),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      customerId: values.customerId,
      type: values.type,
      status: values.status,
      currency: values.currency,
      balance: account ? account.balance : toMinor(values.openingBalance || '0'),
      overdraftLimit: toMinor(values.overdraftLimit || '0'),
      interestRate: Number(values.interestRate) || 0,
    });
  };

  const set = <K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Edit account' : 'Open a new account'}
      description={
        account
          ? 'Update the account’s type, status and terms. Balances change through transactions only.'
          : 'Choose a customer and set the account terms. An opening deposit is recorded as a transaction.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            {account ? 'Save changes' : 'Open account'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Select
          label="Customer"
          value={values.customerId}
          onChange={(e) => set('customerId', e.target.value)}
          error={errors.customerId}
          // Reassigning an account to a different owner would orphan its
          // transaction history, so this is fixed after creation.
          disabled={Boolean(account)}
          hint={account ? 'The account holder cannot be changed.' : undefined}
          options={
            eligible.length === 0
              ? [{ value: '', label: 'No eligible customers' }]
              : eligible.map((c) => ({
                  value: c.id,
                  label: `${fullName(c)} · ${c.customerCode}`,
                }))
          }
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Account type"
            value={values.type}
            onChange={(e) => set('type', e.target.value as AccountType)}
            options={TYPE_OPTIONS}
          />
          <Select
            label="Currency"
            value={values.currency}
            onChange={(e) => set('currency', e.target.value as Currency)}
            options={CURRENCY_OPTIONS}
            disabled={Boolean(account)}
            hint={account ? 'Currency is fixed once the account exists.' : undefined}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!account && (
            <Input
              label="Opening balance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={values.openingBalance}
              onChange={(e) => set('openingBalance', e.target.value)}
              error={errors.openingBalance}
              hint="Recorded as an opening deposit."
            />
          )}
          <Input
            label="Overdraft limit"
            type="text"
            inputMode="decimal"
            value={values.overdraftLimit}
            onChange={(e) => set('overdraftLimit', e.target.value)}
            hint="Amount the balance may go below zero."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Interest rate (%)"
            type="number"
            step="0.01"
            min="0"
            value={values.interestRate}
            onChange={(e) => set('interestRate', e.target.value)}
          />
          <Select
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as AccountStatus)}
            options={STATUS_OPTIONS}
          />
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Deposit / withdraw
// ---------------------------------------------------------------------------

export type MoneyOperation = 'deposit' | 'withdraw';

export function MoneyForm({
  open,
  onClose,
  operation,
  account,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  operation: MoneyOperation;
  account: Account | null;
  onSubmit: (amountMinor: number, description: string) => MoneyResult;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDescription('');
    setError(null);
    setFailure(null);
  }, [open]);

  if (!account) return null;

  const isDeposit = operation === 'deposit';
  const available = account.balance + account.overdraftLimit;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    const amountError = positiveAmount('Amount')(amount);
    if (amountError) {
      setError(amountError);
      return;
    }

    const minor = toMinor(amount);
    if (!isDeposit && minor > available) {
      setError('Amount exceeds the available balance and overdraft.');
      return;
    }
    setError(null);

    // The store performs the authoritative check and can still refuse.
    const result = onSubmit(minor, description.trim());
    if (!result.ok) setFailure(result.error);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isDeposit ? 'Deposit funds' : 'Withdraw funds'}
      description={`${maskAccountNumber(account.accountNumber)} · ${titleCase(account.type)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} variant={isDeposit ? 'primary' : 'secondary'}>
            {isDeposit ? 'Deposit' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="rounded-lg bg-surface-sunken px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-text">Current balance</span>
            <span className="font-semibold text-primary-text tabular">
              {formatCurrency(account.balance, account.currency)}
            </span>
          </div>
          {!isDeposit && account.overdraftLimit > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-text">Available with overdraft</span>
              <span className="font-medium text-secondary-text tabular">
                {formatCurrency(available, account.currency)}
              </span>
            </div>
          )}
        </div>

        <Input
          label={`Amount (${account.currency})`}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error}
          autoFocus
          required
        />

        <Textarea
          label="Description"
          placeholder={isDeposit ? 'Cash deposit at branch' : 'ATM withdrawal'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          hint="Optional — appears on the customer's statement."
        />

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
    </Modal>
  );
}
