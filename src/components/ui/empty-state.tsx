import { AlertTriangle, Inbox, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-muted-text">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <h3 className="text-sm font-semibold text-primary-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-text">{description}</p>
      )}
      {action && (
        <Button size="sm" className="mt-5" onClick={action.onClick} leftIcon={action.icon}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Distinct from `EmptyState`: "no results for your filters" needs a different
 * message and a clear-filters affordance, not a create button.
 */
export function NoResultsState({ onClear, query }: { onClear: () => void; query?: string }) {
  return (
    <EmptyState
      icon={<SearchX className="h-6 w-6" aria-hidden />}
      title="No matching records"
      description={
        query
          ? `Nothing matched “${query}”. Try a different search term or clear your filters.`
          : 'No records match the selected filters. Try widening your criteria.'
      }
      action={{ label: 'Clear filters', onClick: onClear }}
    />
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this section. Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-negative dark:bg-red-500/15">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-primary-text">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-text">{description}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
