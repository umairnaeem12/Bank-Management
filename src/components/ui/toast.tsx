'use client';

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { NotificationLevel } from '@/types';
import { useToastStore, type Toast as ToastData } from '@/store/use-toast-store';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<NotificationLevel, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  error: <XCircle className="h-4 w-4" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4" aria-hidden />,
  info: <Info className="h-4 w-4" aria-hidden />,
};

const ACCENTS: Record<NotificationLevel, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
};

const BARS: Record<NotificationLevel, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    // duration 0 means "sticky until dismissed".
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      // Errors interrupt; everything else waits for a pause in speech.
      role={toast.level === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
        'rounded-xl border border-border-subtle bg-surface p-4 pr-10 card-shadow-lg',
        'animate-slide-in-right',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', BARS[toast.level])} aria-hidden />
      <span className={cn('mt-0.5 shrink-0', ACCENTS[toast.level])}>{ICONS[toast.level]}</span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary-text">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-text">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="absolute right-2 top-3 rounded-md p-1 text-muted-text transition-colors hover:bg-surface-hover hover:text-primary-text"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Fixed-position stack. Mounted once, near the root of the app. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96 no-print"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
