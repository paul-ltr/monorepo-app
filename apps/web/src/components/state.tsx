import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DataFreshness } from '@pilotage/shared';
import { relativeTime } from '@/lib/format';
import { Icon } from './Icon';
import { Button, Card } from './ui';

/** Shimmer skeleton block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pl-pulse rounded-[8px] bg-surface-3 ${className ?? ''}`} />;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 p-1" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-danger-soft text-danger">
        <Icon name="alert" size={22} />
      </span>
      <div className="font-semibold">{t('common.error')}</div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col items-center gap-2 p-8 text-center text-fg-subtle">
      <Icon name="info" size={22} />
      <div className="text-sm">{message ?? t('common.empty')}</div>
    </Card>
  );
}

/** Render-prop boundary: handles loading/error/empty for a TanStack query. */
export function QueryBoundary<T>({
  query,
  children,
  loadingRows,
  isEmpty,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loadingRows?: number;
  isEmpty?: (data: T) => boolean;
}) {
  if (query.isPending) return <LoadingBlock rows={loadingRows} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  if (query.data === undefined) return <EmptyState />;
  if (isEmpty?.(query.data)) return <EmptyState />;
  return <>{children(query.data)}</>;
}

/** "Mis à jour il y a 2 min" badge — turns amber when data is stale/offline. */
export function FreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  const { t } = useTranslation();
  const stale = freshness.stale;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-[8px] px-[11px] py-1.5 ${
        stale ? 'bg-warn-soft' : 'bg-ok-soft'
      }`}
    >
      <span
        className={`h-[7px] w-[7px] rounded-full ${stale ? 'bg-warn' : 'animate-pl-pulse bg-ok'}`}
      />
      <span className="text-xs font-semibold text-fg-muted">
        {stale ? t('common.stale') : t('topbar.updated', { time: relativeTime(freshness.asOf) })}
      </span>
    </div>
  );
}
