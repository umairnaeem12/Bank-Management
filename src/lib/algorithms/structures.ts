/**
 * Data structures backing the app's lookup, queueing and undo features.
 */

// ---------------------------------------------------------------------------
// Indexed collection (hash map lookup)
// ---------------------------------------------------------------------------

/**
 * Wraps a list with a `Map` keyed by id, turning repeated `find` calls
 * (O(n) each) into O(1) lookups. Used anywhere a view joins two collections —
 * e.g. rendering 500 transactions each needing its account and customer.
 */
export class IndexedCollection<T> {
  private readonly index: Map<string, T>;

  constructor(
    private readonly items: readonly T[],
    keyOf: (item: T) => string,
  ) {
    this.index = new Map();
    for (const item of items) this.index.set(keyOf(item), item);
  }

  get(id: string | null | undefined): T | undefined {
    if (id == null) return undefined;
    return this.index.get(id);
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  get all(): readonly T[] {
    return this.items;
  }

  get size(): number {
    return this.index.size;
  }
}

/** Groups items into a `Map` by a derived key — one pass, O(n). */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** Sums a numeric projection over items — avoids intermediate arrays. */
export function sumBy<T>(items: readonly T[], valueOf: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += valueOf(item);
  return total;
}

/** Counts occurrences of a derived key. */
export function countBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Priority queue — service request processing
// ---------------------------------------------------------------------------

/**
 * Binary min-heap. Requests are dequeued by priority then age, so an urgent
 * ticket filed a minute ago outranks a low-priority one from last week.
 *
 * push/pop are O(log n); peek is O(1).
 */
export class PriorityQueue<T> {
  private heap: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop() as T;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  /** Drains the queue into a fully ordered array. Consumes the queue. */
  drain(): T[] {
    const out: T[] = [];
    let next = this.pop();
    while (next !== undefined) {
      out.push(next);
      next = this.pop();
    }
    return out;
  }

  private siftUp(start: number): void {
    let idx = start;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compare(this.heap[idx], this.heap[parent]) >= 0) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private siftDown(start: number): void {
    let idx = start;
    const n = this.heap.length;

    for (;;) {
      const left = idx * 2 + 1;
      const right = left + 1;
      let smallest = idx;

      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === idx) break;

      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Bounded stack — recent-activity trail
// ---------------------------------------------------------------------------

/**
 * LIFO stack with a fixed capacity; pushing past capacity discards the oldest
 * entry. Backs the "recently viewed" trail in the header.
 */
export class BoundedStack<T> {
  private items: T[] = [];

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  toArray(): T[] {
    // Newest first — the order the UI renders.
    return [...this.items].reverse();
  }

  get size(): number {
    return this.items.length;
  }
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

import type { Paginated } from '@/types';

/** Slices a list into a page, clamping `page` into the valid range. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

/**
 * Builds a compact page-number list with ellipses, e.g. [1, '…', 7, 8, 9, '…', 42].
 * Keeps the pager a fixed width no matter how many pages exist.
 */
export function pageWindow(current: number, totalPages: number, radius = 1): Array<number | '…'> {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;

  for (const p of sorted) {
    // Only insert an ellipsis when we actually skipped more than one page.
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }

  return out;
}
