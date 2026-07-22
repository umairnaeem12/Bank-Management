/**
 * Minimal, dependency-free form validation.
 *
 * Deliberately not Zod: the schemas here are small, and keeping validation in
 * plain functions means the same rules can run in a future Express handler
 * without dragging a client bundle along.
 */

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface Validator<T> {
  (value: T): string | null;
}

// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------

export function required(label: string): Validator<string> {
  return (value) => (value.trim().length === 0 ? `${label} is required` : null);
}

export function minLength(label: string, min: number): Validator<string> {
  return (value) =>
    value.trim().length < min ? `${label} must be at least ${min} characters` : null;
}

export function maxLength(label: string, max: number): Validator<string> {
  return (value) => (value.trim().length > max ? `${label} must be under ${max} characters` : null);
}

// Intentionally permissive: over-strict email regexes reject valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function email(label = 'Email'): Validator<string> {
  return (value) => (EMAIL_RE.test(value.trim()) ? null : `Enter a valid ${label.toLowerCase()}`);
}

// Accepts +, spaces, dashes and parens around 7–15 digits (E.164-ish).
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

export function phone(label = 'Phone'): Validator<string> {
  return (value) => (PHONE_RE.test(value.trim()) ? null : `Enter a valid ${label.toLowerCase()}`);
}

/** Validates a money amount entered in major units. */
export function positiveAmount(label = 'Amount'): Validator<string> {
  return (value) => {
    const n = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(n)) return `${label} must be a number`;
    if (n <= 0) return `${label} must be greater than zero`;
    if (n > 10_000_000) return `${label} exceeds the single-transaction limit`;
    return null;
  };
}

export function pastDate(label = 'Date'): Validator<string> {
  return (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return `Enter a valid ${label.toLowerCase()}`;
    if (d.getTime() > Date.now()) return `${label} cannot be in the future`;
    return null;
  };
}

export function minimumAge(years: number, label = 'Date of birth'): Validator<string> {
  return (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return `Enter a valid ${label.toLowerCase()}`;

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return d.getTime() > cutoff.getTime() ? `Customer must be at least ${years} years old` : null;
  };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** Runs validators in order, returning the first failure. */
export function compose<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    for (const v of validators) {
      const error = v(value);
      if (error) return error;
    }
    return null;
  };
}

export type Schema<T> = { [K in keyof T]?: Validator<T[K]> };

/** Validates an object against a schema, collecting every field error. */
export function validate<T extends object>(values: T, schema: Schema<T>): ValidationErrors<T> {
  const errors: ValidationErrors<T> = {};

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const validator = schema[key];
    if (!validator) continue;

    const error = validator(values[key]);
    if (error) errors[key] = error;
  }

  return errors;
}

export function hasErrors<T>(errors: ValidationErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}
