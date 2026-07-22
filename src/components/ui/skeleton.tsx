import { cn } from '@/lib/utils/cn';

/** Base shimmer block. Everything else in this file composes it. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-md bg-surface-sunken', className)}
      {...props}
    />
  );
}

/** Placeholder matching the dashboard's stat tiles. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5 card-shadow">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/** Placeholder matching a data table, including its header row. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="overflow-hidden rounded-card border border-border-subtle bg-surface"
      role="status"
      aria-label="Loading data"
    >
      <div className="flex gap-4 border-b border-border-subtle bg-surface-sunken px-5 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4 flex-1"
              // Varying widths read as data rather than a uniform grey grid.
              style={{ maxWidth: c === 0 ? '28%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5 card-shadow">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-5 w-full rounded-lg" style={{ height }} />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Full-page placeholder used while the stores hydrate. */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}
