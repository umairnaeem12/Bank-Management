'use client';

import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import type { Paginated, SortDirection } from '@/types';
import { cn } from '@/lib/utils/cn';
import { Pagination } from './pagination';
import { TableSkeleton } from './skeleton';

export interface Column<T> {
  /** Stable identifier; also the sort key when `sortable` is set. */
  key: string;
  header: string;
  /** Cell renderer. Receives the row and its index within the page. */
  cell: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Tailwind classes controlling visibility per breakpoint, e.g. 'hidden md:table-cell'. */
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  page: Paginated<T>;
  rowKey: (item: T) => string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  loading?: boolean;
  /** Rendered in place of the table body when there are no rows. */
  emptyState?: React.ReactNode;
  className?: string;
  /** Compact row height, driven by the density setting. */
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  page,
  rowKey,
  sortKey,
  sortDirection = 'asc',
  onSort,
  onRowClick,
  onPageChange,
  pageSize,
  onPageSizeChange,
  loading = false,
  emptyState,
  className,
  dense = false,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={6} columns={Math.min(columns.length, 6)} />;
  }

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border border-border-subtle bg-surface card-shadow',
        className,
      )}
    >
      {/* Horizontal scroll is confined to the table so the page never scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-sunken">
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                const canSort = column.sortable && onSort;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : column.sortable
                          ? 'none'
                          : undefined
                    }
                    className={cn(
                      'px-4 py-3 text-xs font-semibold tracking-wide text-secondary-text uppercase',
                      alignClass(column.align),
                      column.className,
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 transition-colors hover:text-primary-text',
                          column.align === 'right' && 'flex-row-reverse',
                          isSorted && 'text-primary-text',
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {page.items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState}
                </td>
              </tr>
            ) : (
              page.items.map((item, index) => (
                <tr
                  key={rowKey(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  // Rows are only keyboard-reachable when they actually do something.
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(item);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-border-subtle transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-hover focus:bg-surface-hover',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 text-primary-text',
                        dense ? 'py-2.5' : 'py-3.5',
                        alignClass(column.align),
                        column.className,
                      )}
                    >
                      {column.cell(item, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page.total > 0 && (
        <Pagination
          page={page}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
