'use client';

/**
 * Session state.
 *
 * Kept separate from the data store because its lifecycle is different: the
 * session is written on sign-in, cleared on sign-out, and read by the route
 * guard before any data is needed.
 */

import { create } from 'zustand';
import type { Session } from '@/types';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '@/lib/storage/local-storage';
import { SESSION_TTL_MS, verifyCredentials, type AuthFailure } from '@/lib/auth/credentials';

interface AuthState {
  session: Session | null;
  /** False until the stored session has been read on the client. */
  hydrated: boolean;
  pending: boolean;
  error: string | null;

  hydrate: () => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
}

const ERROR_MESSAGES: Record<AuthFailure, string> = {
  'invalid-credentials': 'That email and password combination is not recognised.',
  'unknown-error': 'Something went wrong while signing in. Please try again.',
};

/** A session is valid only if it exists and has not passed its expiry. */
function isLive(session: Session | null): session is Session {
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  pending: false,
  error: null,

  hydrate: () => {
    const stored = readStorage<Session | null>(STORAGE_KEYS.session, null);

    if (!isLive(stored)) {
      // Expired sessions are cleared eagerly so a stale entry can't linger.
      if (stored) removeStorage(STORAGE_KEYS.session);
      set({ session: null, hydrated: true });
      return;
    }

    set({ session: stored, hydrated: true });
  },

  signIn: async (email, password, remember) => {
    set({ pending: true, error: null });

    try {
      const result = await verifyCredentials(email, password);

      if (!result.ok || !result.credential) {
        set({ pending: false, error: ERROR_MESSAGES[result.error ?? 'unknown-error'] });
        return false;
      }

      const now = Date.now();
      // "Remember me" extends the window to 30 days; otherwise the standard
      // 8-hour working-day session applies.
      const ttl = remember ? 30 * 24 * 60 * 60 * 1000 : SESSION_TTL_MS;

      const session: Session = {
        staffId: result.credential.staffId,
        email: result.credential.email,
        name: result.credential.name,
        role: result.credential.role,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttl).toISOString(),
      };

      writeStorage(STORAGE_KEYS.session, session);
      set({ session, pending: false, error: null });
      return true;
    } catch {
      set({ pending: false, error: ERROR_MESSAGES['unknown-error'] });
      return false;
    }
  },

  signOut: () => {
    removeStorage(STORAGE_KEYS.session);
    set({ session: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
