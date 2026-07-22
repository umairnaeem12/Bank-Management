/**
 * Search primitives.
 *
 * The dataset here is small enough that a linear scan would work, but these
 * are written to stay correct at scale and are unit-testable in isolation.
 */

/**
 * Binary search over an array sorted ascending by `select`.
 *
 * @returns index of a matching element, or -1.
 */
export function binarySearchBy<T, K>(
  sorted: readonly T[],
  target: K,
  select: (item: T) => K,
  compare: (a: K, b: K) => number = defaultCompare,
): number {
  let lo = 0;
  let hi = sorted.length - 1;

  while (lo <= hi) {
    // Avoids overflow on very large arrays (vs. `(lo + hi) / 2`).
    const mid = lo + ((hi - lo) >> 1);
    const cmp = compare(select(sorted[mid]), target);

    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}

/**
 * Leftmost insertion point for `target` — the first index whose value is
 * `>= target`. Used to find range boundaries (e.g. "transactions on or after
 * this date") in O(log n) instead of filtering the whole list.
 */
export function lowerBound<T, K>(
  sorted: readonly T[],
  target: K,
  select: (item: T) => K,
  compare: (a: K, b: K) => number = defaultCompare,
): number {
  let lo = 0;
  let hi = sorted.length;

  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (compare(select(sorted[mid]), target) < 0) lo = mid + 1;
    else hi = mid;
  }

  return lo;
}

/** First index whose value is `> target`. Pairs with `lowerBound` for ranges. */
export function upperBound<T, K>(
  sorted: readonly T[],
  target: K,
  select: (item: T) => K,
  compare: (a: K, b: K) => number = defaultCompare,
): number {
  let lo = 0;
  let hi = sorted.length;

  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (compare(select(sorted[mid]), target) <= 0) lo = mid + 1;
    else hi = mid;
  }

  return lo;
}

/**
 * Extracts the inclusive slice of a sorted array falling within [from, to].
 * O(log n) boundary lookup + O(k) copy, where k is the result size.
 */
export function sortedRange<T, K>(
  sorted: readonly T[],
  from: K | null,
  to: K | null,
  select: (item: T) => K,
  compare: (a: K, b: K) => number = defaultCompare,
): T[] {
  const start = from === null ? 0 : lowerBound(sorted, from, select, compare);
  const end = to === null ? sorted.length : upperBound(sorted, to, select, compare);
  return start >= end ? [] : sorted.slice(start, end);
}

function defaultCompare<K>(a: K, b: K): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Fuzzy / token matching for the global search bar
// ---------------------------------------------------------------------------

/**
 * Scores a candidate string against a query. Higher is better; 0 means no
 * match. The ranking is deliberately simple and predictable:
 *
 *   exact match            → 1000
 *   prefix match           → 500 + length bonus
 *   word-boundary prefix   → 250
 *   substring              → 100
 *   subsequence (fuzzy)    → 1..50 based on character adjacency
 */
export function scoreMatch(candidate: string, query: string): number {
  if (!query) return 0;

  const hay = candidate.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 0;

  if (hay === needle) return 1000;
  if (hay.startsWith(needle)) return 500 + Math.round((needle.length / hay.length) * 100);

  // Match at the start of any word, e.g. "smith" in "John Smith".
  const words = hay.split(/[\s\-_.@]+/);
  if (words.some((w) => w.startsWith(needle))) return 250;

  const idx = hay.indexOf(needle);
  if (idx >= 0) return 100 - Math.min(idx, 50);

  return subsequenceScore(hay, needle);
}

/**
 * Rewards queries whose characters appear in order, with a bonus for
 * consecutive runs so "jsm" ranks "John Smith" above an incidental scatter.
 */
function subsequenceScore(hay: string, needle: string): number {
  let hi = 0;
  let matched = 0;
  let runBonus = 0;
  let lastMatchIdx = -2;

  for (let ni = 0; ni < needle.length; ni++) {
    const found = hay.indexOf(needle[ni], hi);
    if (found === -1) return 0; // not a subsequence → no match at all
    if (found === lastMatchIdx + 1) runBonus += 2;
    lastMatchIdx = found;
    hi = found + 1;
    matched++;
  }

  if (matched < needle.length) return 0;
  return Math.min(50, 10 + runBonus);
}

/** Ranks items by their best field score, dropping non-matches. */
export function rankBySearch<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => string[],
  limit?: number,
): T[] {
  if (!query.trim()) return limit ? items.slice(0, limit) : [...items];

  const scored: Array<{ item: T; score: number }> = [];

  for (const item of items) {
    let best = 0;
    for (const field of fields(item)) {
      const s = scoreMatch(field, query);
      if (s > best) best = s;
    }
    if (best > 0) scored.push({ item, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((s) => s.item);
  return limit ? ranked.slice(0, limit) : ranked;
}
