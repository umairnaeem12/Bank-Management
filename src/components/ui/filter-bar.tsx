'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

/**
 * The search + filters row that sits above every data table.
 * Filters live in one row above the table, never inside it.
 */
export function FilterBar({
  query,
  onQueryChange,
  placeholder = 'Search…',
  filters = [],
  onReset,
  actions,
  activeFilterCount = 0,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  filters?: FilterSelectProps[];
  onReset?: () => void;
  actions?: React.ReactNode;
  activeFilterCount?: number;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className={cn(
              'h-9 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm',
              'text-primary-text placeholder:text-muted-text',
              'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            )}
          />
        </div>

        {filters.map((filter) => (
          <select
            key={filter.label}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.label}
            className={cn(
              'h-9 cursor-pointer rounded-lg border border-border-strong bg-surface px-2.5 text-sm',
              'text-primary-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
              filter.value !== 'all' && 'border-brand-400 text-brand-700 dark:text-brand-300',
            )}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        {/* Only offer a reset once something is actually filtered. */}
        {onReset && (activeFilterCount > 0 || query.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            leftIcon={<X className="h-3.5 w-3.5" aria-hidden />}
          >
            Clear
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Compact indicator used in page headers to show filters are narrowing results. */
export function FilterSummary({ shown, total }: { shown: number; total: number }) {
  if (shown === total) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-text">
      <SlidersHorizontal className="h-3 w-3" aria-hidden />
      Showing {shown} of {total}
    </span>
  );
}
