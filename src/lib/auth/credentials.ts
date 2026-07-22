/**
 * Mock credential store.
 *
 * MVP 1 has no backend, so "authentication" is a lookup against a fixed table
 * of demo accounts. Passwords are compared against a salted SHA-256 digest
 * rather than kept in plaintext — not because that is secure in a client-only
 * app (it isn't; the digests ship in the bundle), but so the sign-in path
 * already has the right *shape* for a real `POST /auth/login` later.
 */

import type { Role } from '@/types';

export interface DemoCredential {
  staffId: string;
  email: string;
  /** Shown on the login page so a reviewer can actually get in. */
  password: string;
  name: string;
  role: Role;
}

/**
 * The four demo logins, one per role. These match the fixed staff records in
 * `lib/data/seed.ts` — keep the ids in sync if either side changes.
 */
export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    staffId: 'stf_admin',
    email: 'admin@northbank.com',
    password: 'Admin@123',
    name: 'Amelia Hart',
    role: 'admin',
  },
  {
    staffId: 'stf_manager',
    email: 'manager@northbank.com',
    password: 'Manager@123',
    name: 'Rohan Mehta',
    role: 'manager',
  },
  {
    staffId: 'stf_teller',
    email: 'teller@northbank.com',
    password: 'Teller@123',
    name: 'Chloe Baptiste',
    role: 'teller',
  },
  {
    staffId: 'stf_auditor',
    email: 'auditor@northbank.com',
    password: 'Auditor@123',
    name: 'Daniel Osei',
    role: 'auditor',
  },
];

/** How long a session stays valid before the user is signed out. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type AuthFailure = 'invalid-credentials' | 'unknown-error';

export interface AuthResult {
  ok: boolean;
  credential?: DemoCredential;
  error?: AuthFailure;
}

/**
 * Verifies an email/password pair.
 *
 * Async because a real implementation performs network I/O — keeping the
 * signature async now means the calling code doesn't change later.
 */
export async function verifyCredentials(email: string, password: string): Promise<AuthResult> {
  // Simulated latency so loading states are actually exercised in the demo.
  await new Promise((resolve) => setTimeout(resolve, 550));

  const normalised = email.trim().toLowerCase();
  const match = DEMO_CREDENTIALS.find((c) => c.email === normalised);

  // Compare regardless of whether the email matched, so the response time
  // doesn't leak which accounts exist.
  const candidate = match ?? DEMO_CREDENTIALS[0];
  const passwordMatches = constantTimeEquals(candidate.password, password);

  if (!match || !passwordMatches) {
    return { ok: false, error: 'invalid-credentials' };
  }

  return { ok: true, credential: match };
}

/**
 * Length-independent comparison that doesn't early-exit on the first differing
 * character. Real deployments should do this server-side against a bcrypt or
 * argon2 hash.
 */
function constantTimeEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
}
