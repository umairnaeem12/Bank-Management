'use client';

/**
 * Toast notifications.
 *
 * A store rather than context so any module can fire a toast without the
 * component tree threading a callback down — `toast.success(...)` works from
 * inside an event handler, a store action, or a hook.
 */

import { create } from 'zustand';
import type { NotificationLevel } from '@/types';
import { createId } from '@/lib/utils/id';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  level: NotificationLevel;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed manually. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** Cap so a burst of events can't cover the screen. */
const MAX_VISIBLE = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    const id = createId('tst');
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }));
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/**
 * Ergonomic wrapper. Calling the store's `push` directly works too, but this
 * keeps call sites to a single readable line.
 */
export const toast = {
  success(title: string, description?: string) {
    return useToastStore.getState().push({ title, description, level: 'success', duration: 4000 });
  },
  error(title: string, description?: string) {
    // Errors linger longer — the user usually needs to read them.
    return useToastStore.getState().push({ title, description, level: 'error', duration: 6500 });
  },
  info(title: string, description?: string) {
    return useToastStore.getState().push({ title, description, level: 'info', duration: 4000 });
  },
  warning(title: string, description?: string) {
    return useToastStore.getState().push({ title, description, level: 'warning', duration: 5500 });
  },
};
