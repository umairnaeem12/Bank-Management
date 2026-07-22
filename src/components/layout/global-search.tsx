'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ClipboardList, CreditCard, Search, UserCog, Users } from 'lucide-react';
import { useBankStore } from '@/store/use-bank-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { rankBySearch } from '@/lib/algorithms/search';
import { formatCurrency, fullName, maskAccountNumber, titleCase } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type ResultKind = 'customer' | 'account' | 'transaction' | 'request' | 'staff';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  href: string;
}

const KIND_ICONS: Record<ResultKind, React.ReactNode> = {
  customer: <Users className="h-4 w-4" aria-hidden />,
  account: <CreditCard className="h-4 w-4" aria-hidden />,
  transaction: <ArrowLeftRight className="h-4 w-4" aria-hidden />,
  request: <ClipboardList className="h-4 w-4" aria-hidden />,
  staff: <UserCog className="h-4 w-4" aria-hidden />,
};

const KIND_LABELS: Record<ResultKind, string> = {
  customer: 'Customers',
  account: 'Accounts',
  transaction: 'Transactions',
  request: 'Requests',
  staff: 'Staff',
};

/** Cap per category so one entity type can't crowd out the others. */
const PER_KIND_LIMIT = 4;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(query, 180);

  const customers = useBankStore((s) => s.customers);
  const accounts = useBankStore((s) => s.accounts);
  const transactions = useBankStore((s) => s.transactions);
  const requests = useBankStore((s) => s.requests);
  const staff = useBankStore((s) => s.staff);

  const results = useMemo<SearchResult[]>(() => {
    const q = debounced.trim();
    if (q.length < 2) return [];

    const customerHits = rankBySearch(
      customers,
      q,
      (c) => [fullName(c), c.email, c.customerCode, c.phone, c.city],
      PER_KIND_LIMIT,
    ).map<SearchResult>((c) => ({
      id: c.id,
      kind: 'customer',
      title: fullName(c),
      subtitle: `${c.customerCode} · ${c.email}`,
      href: `/customers/${c.id}`,
    }));

    const accountHits = rankBySearch(
      accounts,
      q,
      (a) => [a.accountNumber, a.type, a.currency],
      PER_KIND_LIMIT,
    ).map<SearchResult>((a) => ({
      id: a.id,
      kind: 'account',
      title: maskAccountNumber(a.accountNumber),
      subtitle: `${titleCase(a.type)} · ${formatCurrency(a.balance, a.currency)}`,
      href: `/accounts/${a.id}`,
    }));

    // Transactions are the largest collection; searching only the most recent
    // 200 keeps every keystroke fast without meaningfully hurting recall.
    const transactionHits = rankBySearch(
      transactions.slice(0, 200),
      q,
      (t) => [t.reference, t.description, t.type],
      PER_KIND_LIMIT,
    ).map<SearchResult>((t) => ({
      id: t.id,
      kind: 'transaction',
      title: t.reference,
      subtitle: `${titleCase(t.type)} · ${formatCurrency(t.amount, t.currency)} · ${t.description}`,
      href: `/transactions?ref=${encodeURIComponent(t.reference)}`,
    }));

    const requestHits = rankBySearch(
      requests,
      q,
      (r) => [r.ticket, r.subject, r.type],
      PER_KIND_LIMIT,
    ).map<SearchResult>((r) => ({
      id: r.id,
      kind: 'request',
      title: r.ticket,
      subtitle: r.subject,
      href: `/requests/${r.id}`,
    }));

    const staffHits = rankBySearch(
      staff,
      q,
      (s) => [fullName(s), s.email, s.employeeCode, s.branch],
      PER_KIND_LIMIT,
    ).map<SearchResult>((s) => ({
      id: s.id,
      kind: 'staff',
      title: fullName(s),
      subtitle: `${s.employeeCode} · ${titleCase(s.role)}`,
      href: `/staff/${s.id}`,
    }));

    return [...customerHits, ...accountHits, ...transactionHits, ...requestHits, ...staffHits];
  }, [debounced, customers, accounts, transactions, requests, staff]);

  // Reset the highlighted row whenever the result set changes.
  useEffect(() => setActiveIndex(0), [debounced]);

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // ⌘K / Ctrl-K to focus, matching the affordance shown in the input.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * Navigates to a result and clears the search.
   *
   * Deliberately does not blur the input: keeping focus lets the user keep
   * typing a new query after jumping somewhere, and closing the panel already
   * dismisses the dropdown.
   */
  const go = useCallback(
    (result: SearchResult) => {
      router.push(result.href);
      setQuery('');
      setOpen(false);
    },
    [router],
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target);
    }
  };

  const showPanel = open && debounced.trim().length >= 2;

  // Group for rendering while keeping the flat index used by keyboard nav.
  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          placeholder="Search customers, accounts, transactions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          className={cn(
            'h-10 w-full rounded-lg border border-border-strong bg-surface-sunken pl-9 pr-16 text-sm',
            'text-primary-text placeholder:text-muted-text',
            'focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            // Suppress the native clear button; it collides with the ⌘K hint.
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-text sm:block">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-xl border border-border-subtle bg-surface py-2 card-shadow-lg animate-scale-in"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-text">
              No matches for “{debounced.trim()}”.
            </p>
          ) : (
            (Object.keys(KIND_LABELS) as ResultKind[]).map((kind) => {
              const group = results.filter((r) => r.kind === kind);
              if (group.length === 0) return null;

              return (
                <div key={kind} className="mb-1 last:mb-0">
                  <p className="px-4 py-1.5 text-[10px] font-semibold tracking-wider text-muted-text uppercase">
                    {KIND_LABELS[kind]}
                  </p>
                  {group.map((result) => {
                    flatIndex += 1;
                    const isActive = flatIndex === activeIndex;
                    // Captured per-item so the handler doesn't re-scan the list.
                    const ownIndex = flatIndex;

                    return (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => go(result)}
                        onMouseEnter={() => setActiveIndex(ownIndex)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isActive ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-surface-hover',
                        )}
                      >
                        <span className="shrink-0 text-muted-text">{KIND_ICONS[result.kind]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-primary-text">
                            {result.title}
                          </span>
                          <span className="block truncate text-xs text-muted-text">
                            {result.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
