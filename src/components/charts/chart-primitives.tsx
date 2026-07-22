'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { chartChrome } from '@/lib/charts/palette';

/**
 * Tracks the resolved theme by observing the `dark` class on <html>.
 *
 * Charts need the *actual* rendered theme (not the stored preference) to pick
 * their palette, and they must repaint when the user toggles it. Reading the
 * class directly means this stays correct whether the theme came from the
 * setting, the OS, or the pre-paint init script.
 */
export function useIsDarkChart(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

/**
 * Shared tooltip shell. Recharts passes an untyped payload, so each chart maps
 * it into `TooltipEntry[]` and hands it here for consistent presentation.
 */
export function ChartTooltip({
  label,
  entries,
  formatValue,
  isDark,
}: {
  label?: string;
  entries: TooltipEntry[];
  formatValue: (value: number) => string;
  isDark: boolean;
}) {
  const chrome = chartChrome(isDark);

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs card-shadow-lg"
      style={{
        backgroundColor: chrome.tooltipBg,
        borderColor: chrome.tooltipBorder,
        color: chrome.text,
      }}
    >
      {label && <p className="mb-1.5 font-semibold">{label}</p>}
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            {/* Label and value use text tokens, never the series colour. */}
            <span className="flex-1 text-muted-text">{entry.name}</span>
            <span className="font-medium tabular">{formatValue(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legend rendered outside the plot so identity is never colour-alone. */
export function ChartLegend({
  items,
  className,
}: {
  items: Array<{ label: string; color: string }>;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-secondary-text">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Placeholder shown when a chart has no data to plot. */
export function ChartEmpty({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center">
      <p className="text-xs text-muted-text">{message}</p>
    </div>
  );
}
