/**
 * Formatting helpers. All money in the app is stored as integer minor units
 * (cents) — see `Cents` in `@/types` — so every display path goes through
 * `formatCurrency` rather than doing ad-hoc division.
 */

import type { Cents, Currency, ISODateString } from '@/types';

const CURRENCY_LOCALE: Record<Currency, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  PKR: 'en-PK',
};

/** Renders minor units as a localised currency string, e.g. 125050 → "$1,250.50". */
export function formatCurrency(
  amount: Cents,
  currency: Currency = 'USD',
  options: { compact?: boolean; showSign?: boolean } = {},
): string {
  const { compact = false, showSign = false } = options;
  const major = amount / 100;

  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(major);

  if (showSign && amount > 0) return `+${formatted}`;
  return formatted;
}

/** Converts a user-entered major-unit string ("1,250.50") to cents (125050). */
export function toMinor(input: string | number): Cents {
  const raw = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(raw)) return 0;
  // Round rather than truncate so 0.1 + 0.2 style drift can't shave a cent.
  return Math.round(raw * 100);
}

/** Converts cents to a plain major-unit number, for chart axes and inputs. */
export function toMajor(amount: Cents): number {
  return amount / 100;
}

export function formatNumber(value: number, compact = false): string {
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value >= 0 ? '' : ''}${value.toFixed(fractionDigits)}%`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function formatDate(iso: ISODateString, style: 'iso' | 'us' | 'eu' = 'us'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  if (style === 'iso') return d.toISOString().slice(0, 10);

  return new Intl.DateTimeFormat(style === 'us' ? 'en-US' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(iso: ISODateString, style: 'iso' | 'us' | 'eu' = 'us'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  if (style === 'iso') return d.toISOString().replace('T', ' ').slice(0, 16);

  return new Intl.DateTimeFormat(style === 'us' ? 'en-US' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/**
 * "3 hours ago" style output.
 *
 * `now` is injectable so server and client renders can agree — passing the
 * hydration-stable timestamp avoids React complaining about mismatched text.
 */
export function formatRelative(iso: ISODateString, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const diff = then - now;
  const abs = Math.abs(diff);

  if (abs < 60_000) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }

  return 'just now';
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/**
 * Initials from a full name of any shape: "Amelia Hart" → "AH", "Cher" → "C",
 * "Maria de la Cruz" → "MC" (first + last word, ignoring the middle).
 */
export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** "fixed-deposit" → "Fixed Deposit" */
export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Masks all but the last 4 characters: "1234567890" → "•••• 7890". */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• ${accountNumber.slice(-4)}`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
