/**
 * Deterministic-friendly id and reference generators.
 *
 * The seeded PRNG is what lets `seed.ts` produce the *same* demo dataset on
 * every machine — important so screenshots, tests and the numbers a reviewer
 * sees all line up.
 */

/**
 * Mulberry32 — small, fast, well-distributed 32-bit PRNG.
 * Returns a function producing floats in [0, 1).
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;

  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a random element using the supplied RNG. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Integer in [min, max] inclusive. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Unique id for records created at runtime.
 *
 * `crypto.randomUUID` is preferred where available; the counter fallback keeps
 * ids unique in older browsers and during SSR.
 */
let counter = 0;
export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Zero-pads a number to a fixed width: (42, 6) → "000042". */
export function padCode(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
