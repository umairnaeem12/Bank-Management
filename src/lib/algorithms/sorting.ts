/**
 * Sorting utilities.
 *
 * `mergeSort` is used where stability matters (e.g. a table sorted by date and
 * then re-sorted by amount should preserve date order within equal amounts).
 * `Array.prototype.sort` is specified as stable in modern engines, but an
 * explicit implementation keeps the guarantee visible and portable.
 */

import type { SortDirection } from '@/types';

export type Comparator<T> = (a: T, b: T) => number;

/** Stable merge sort — O(n log n) time, O(n) space. Does not mutate `input`. */
export function mergeSort<T>(input: readonly T[], compare: Comparator<T>): T[] {
  if (input.length <= 1) return [...input];

  const mid = input.length >> 1;
  const left = mergeSort(input.slice(0, mid), compare);
  const right = mergeSort(input.slice(mid), compare);

  return merge(left, right, compare);
}

function merge<T>(left: T[], right: T[], compare: Comparator<T>): T[] {
  const out: T[] = new Array(left.length + right.length);
  let i = 0;
  let j = 0;
  let k = 0;

  while (i < left.length && j < right.length) {
    // `<= 0` keeps left-hand elements first on ties → stability.
    out[k++] = compare(left[i], right[j]) <= 0 ? left[i++] : right[j++];
  }
  while (i < left.length) out[k++] = left[i++];
  while (j < right.length) out[k++] = right[j++];

  return out;
}

/**
 * Partial sort: returns the top `k` elements without fully ordering the rest.
 * Uses a bounded max-heap-by-inversion (i.e. a min-heap of the best k seen),
 * giving O(n log k) — noticeably better than a full sort when k << n, as in
 * "top 5 accounts by balance" widgets.
 */
export function topK<T>(items: readonly T[], k: number, compare: Comparator<T>): T[] {
  if (k <= 0) return [];
  if (k >= items.length) return mergeSort(items, compare);

  // Min-heap ordered by the inverse comparator: the root is the *worst* of the
  // current best-k, so it is the element to evict.
  const heap: T[] = [];
  const worseFirst: Comparator<T> = (a, b) => -compare(a, b);

  for (const item of items) {
    if (heap.length < k) {
      heapPush(heap, item, worseFirst);
    } else if (compare(item, heap[0]) < 0) {
      // `item` sorts before the current worst → replace it.
      heap[0] = item;
      siftDown(heap, 0, worseFirst);
    }
  }

  return mergeSort(heap, compare);
}

function heapPush<T>(heap: T[], item: T, compare: Comparator<T>): void {
  heap.push(item);
  siftUp(heap, heap.length - 1, compare);
}

function siftUp<T>(heap: T[], start: number, compare: Comparator<T>): void {
  let idx = start;
  while (idx > 0) {
    const parent = (idx - 1) >> 1;
    if (compare(heap[idx], heap[parent]) >= 0) break;
    [heap[idx], heap[parent]] = [heap[parent], heap[idx]];
    idx = parent;
  }
}

function siftDown<T>(heap: T[], start: number, compare: Comparator<T>): void {
  let idx = start;
  const n = heap.length;

  for (;;) {
    const left = idx * 2 + 1;
    const right = left + 1;
    let smallest = idx;

    if (left < n && compare(heap[left], heap[smallest]) < 0) smallest = left;
    if (right < n && compare(heap[right], heap[smallest]) < 0) smallest = right;
    if (smallest === idx) break;

    [heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
    idx = smallest;
  }
}

// ---------------------------------------------------------------------------
// Comparator builders
// ---------------------------------------------------------------------------

/** Builds a comparator for a field, handling strings, numbers and nulls. */
export function byField<T>(key: keyof T, direction: SortDirection = 'asc'): Comparator<T> {
  const sign = direction === 'asc' ? 1 : -1;

  return (a, b) => {
    const av = a[key];
    const bv = b[key];

    // Nulls always sort last regardless of direction — an empty cell at the
    // top of a descending table reads as a bug to users.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === 'string' && typeof bv === 'string') {
      return sign * av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (av < bv) return -sign;
    if (av > bv) return sign;
    return 0;
  };
}

/** Chains comparators: the first non-zero result wins. */
export function chain<T>(...comparators: Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}
