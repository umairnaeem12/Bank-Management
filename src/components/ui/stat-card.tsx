import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface StatCardProps {
  label: string;
  /** Pre-formatted headline figure. */
  value: string;
  icon: React.ReactNode;
  /** Percentage change vs. the previous period. */
  trend?: number;
  trendLabel?: string;
  /** Accent colour for the icon chip. Defaults to brand blue. */
  tone?: 'brand' | 'teal' | 'amber' | 'purple';
  hint?: string;
}

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
} as const;

/**
 * A single headline figure. Used in place of a chart where the data's job is
 * to state one number rather than show a shape.
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel = 'vs. last 30 days',
  tone = 'brand',
  hint,
}: StatCardProps) {
  const hasTrend = trend !== undefined && Number.isFinite(trend);
  const isUp = hasTrend && trend >= 0;

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5 card-shadow transition-shadow hover:card-shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-text">{label}</p>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            TONES[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-primary-text tabular">
        {value}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        {hasTrend ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                // Direction is carried by the arrow icon as well as the colour.
                isUp
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {isUp ? '+' : ''}
              {trend.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-text">{trendLabel}</span>
          </>
        ) : (
          hint && <span className="text-xs text-muted-text">{hint}</span>
        )}
      </div>
    </div>
  );
}
