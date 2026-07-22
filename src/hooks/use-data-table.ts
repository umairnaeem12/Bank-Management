'use client';

/**
 * The shared engine behind every data table in the app.
 *
 * Search → filter → sort → paginate, memoised at each step so a page change
 * doesn't re-run the search, and a sort change doesn't re-run filtering.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Paginated, SortDirection } from '@/types';
import { mergeSort, byField, type Comparator } from '@/lib/algorithms/sorting';
import { rankBySearch } from '@/lib/algorithms/search';
import { paginate } from '@/lib/algorithms/structures';
import { useDebouncedValue } from './use-debounced-value';

export interface DataTableOptions<T> {
  /** The full, unfiltered dataset. */
  data: readonly T[];
  /** Fields fed to the fuzzy ranker for the search box. */
  searchFields: (item: T) => string[];
  /** Predicate applied before sorting, e.g. status/date filters. */
  filter?: (item: T) => boolean;
  initialSort?: { key: keyof T; direction: SortDirection };
  /** Overrides `byField` when a column needs custom ordering. */
  comparators?: Partial<Record<keyof T, Comparator<T>>>;
  pageSize?: number;
}

export interface DataTableResult<T> {
  page: Paginated<T>;
  query: string;
  setQuery: (value: string) => void;
  sortKey: keyof T | null;
  sortDirection: SortDirection;
  toggleSort: (key: keyof T) => void;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  /** Everything matching search + filters, before pagination — used for export. */
  filteredAll: T[];
  /** True when filters are active but nothing matched (vs. an empty dataset). */
  isFilteredEmpty: boolean;
  reset: () => void;
}

export function useDataTable<T>({
  data,
  searchFields,
  filter,
  initialSort,
  comparators,
  pageSize: initialPageSize = 10,
}: DataTableOptions<T>): DataTableResult<T> {
  const [query, setQueryRaw] = useState('');
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<keyof T | null>(initialSort?.key ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSort?.direction ?? 'asc',
  );

  const debouncedQuery = useDebouncedValue(query, 220);

  // 1. Search — ranked, so the closest match floats to the top.
  const searched = useMemo(() => {
    if (!debouncedQuery.trim()) return data as T[];
    return rankBySearch(data, debouncedQuery, searchFields);
    // `searchFields` is a fresh closure each render; depending on it would
    // defeat the memo, so it is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, debouncedQuery]);

  // 2. Filter.
  const filtered = useMemo(() => {
    if (!filter) return searched;
    return searched.filter(filter);
  }, [searched, filter]);

  // 3. Sort. Skipped entirely while a search is active, because the ranker has
  //    already ordered results by relevance and re-sorting would discard that.
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    if (debouncedQuery.trim()) return filtered;

    const custom = comparators?.[sortKey];
    const comparator = custom
      ? (a: T, b: T) => (sortDirection === 'asc' ? custom(a, b) : -custom(a, b))
      : byField<T>(sortKey, sortDirection);

    return mergeSort(filtered, comparator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDirection, debouncedQuery]);

  // 4. Paginate.
  const page = useMemo(() => paginate(sorted, pageIndex, pageSize), [sorted, pageIndex, pageSize]);

  const setQuery = useCallback((value: string) => {
    setQueryRaw(value);
    // A new query invalidates the current page number.
    setPageIndex(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageIndex(1);
  }, []);

  const toggleSort = useCallback((key: keyof T) => {
    setPageIndex(1);
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return currentKey;
      }
      setSortDirection('asc');
      return key;
    });
  }, []);

  const reset = useCallback(() => {
    setQueryRaw('');
    setPageIndex(1);
    setSortKey(initialSort?.key ?? null);
    setSortDirection(initialSort?.direction ?? 'asc');
  }, [initialSort?.key, initialSort?.direction]);

  return {
    page,
    query,
    setQuery,
    sortKey,
    sortDirection,
    toggleSort,
    setPage: setPageIndex,
    pageSize,
    setPageSize,
    filteredAll: sorted,
    isFilteredEmpty: sorted.length === 0 && data.length > 0,
    reset,
  };
}
