'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated } from '@/types';
import { pageWindow } from '@/lib/algorithms/structures';
import { cn } from '@/lib/utils/cn';

const PAGE_SIZES = [10, 25, 50, 100];

export interface PaginationProps<T> {
  page: Paginated<T>;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination<T>({
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: PaginationProps<T>) {
  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const pages = pageWindow(page.page, page.totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3"
    >
      <div className="flex items-center gap-3 text-xs text-muted-text">
        <span className="tabular">
          Showing <span className="font-medium text-primary-text">{from}</span>–
          <span className="font-medium text-primary-text">{to}</span> of{' '}
          <span className="font-medium text-primary-text">{page.total}</span>
        </span>

        {onPageSizeChange && pageSize !== undefined && (
          <label className="hidden items-center gap-1.5 sm:flex">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 rounded-md border border-border-strong bg-surface px-1.5 text-xs text-primary-text focus:border-brand-500 focus:outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page.page - 1)}
          disabled={page.page <= 1}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PageButton>

        {pages.map((entry, i) =>
          entry === '…' ? (
            <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-text" aria-hidden>
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              onClick={() => onPageChange(entry)}
              active={entry === page.page}
              label={`Page ${entry}`}
              current={entry === page.page}
            >
              {entry}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={() => onPageChange(page.page + 1)}
          disabled={page.page >= page.totalPages}
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  label,
  current,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  current?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-brand-600 text-white'
          : 'text-secondary-text hover:bg-surface-hover hover:text-primary-text',
      )}
    >
      {children}
    </button>
  );
}
