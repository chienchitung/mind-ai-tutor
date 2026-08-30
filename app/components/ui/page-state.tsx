import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-5', className)} aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-border/70 bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-card" />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={cn('app-panel flex flex-col items-center justify-center px-6 text-center', compact ? 'py-10' : 'min-h-72 py-16')}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div className="app-panel flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {retryLabel || 'Try again'}
        </Button>
      )}
    </div>
  );
}
