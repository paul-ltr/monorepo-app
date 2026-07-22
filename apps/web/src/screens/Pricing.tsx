import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PriceSlot, PromotionStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money2 } from '@/lib/format';
import { Card, ScreenHeader } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const SLOTS: { key: PriceSlot; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'offpeak', label: 'Heures creuses' },
  { key: 'peak', label: 'Heures pleines' },
  { key: 'weekend', label: 'Week-end' },
];

const PROMO_META: Record<PromotionStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-ok-soft text-ok' },
  scheduled: { label: 'Planifiée', cls: 'bg-info-soft text-info' },
  draft: { label: 'Brouillon', cls: 'bg-surface-3 text-fg-subtle' },
  paused: { label: 'En pause', cls: 'bg-warn-soft text-warn' },
};

/** Tarifs & yield — descriptive read-only view of the current price grid + promos. */
export function Pricing() {
  const { t } = useTranslation();
  const api = useApi();
  const { isAll, label } = useScope();
  const query = useQuery({ queryKey: ['pricing'], queryFn: () => api.getPricing() });

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.pricing')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            {/* Grille tarifaire */}
            <Card className="mb-[18px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-[18px] py-3">
                <div className="text-[15px] font-bold">Grille tarifaire</div>
                <span className="text-[12px] text-fg-subtle">{d.gridName}</span>
              </div>
              <div className="overflow-x-auto">
                <div className="grid min-w-[520px] grid-cols-[1.4fr_repeat(4,1fr)] gap-2 border-b border-border px-[18px] py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                  <div>Programme</div>
                  {SLOTS.map((s) => (
                    <div key={s.key} className="text-right">
                      {s.label}
                    </div>
                  ))}
                </div>
                {d.grid.map((row) => (
                  <div
                    key={row.programId}
                    className="grid min-w-[520px] grid-cols-[1.4fr_repeat(4,1fr)] items-center gap-2 border-b border-border px-[18px] py-2.5 last:border-b-0"
                  >
                    <div className="truncate text-[12.5px] font-semibold">{row.programLabel}</div>
                    {SLOTS.map((s) => {
                      const p = row.prices[s.key];
                      return (
                        <div
                          key={s.key}
                          className="text-right text-[12.5px] tabular-nums text-fg-muted"
                        >
                          {p ? money2(p) : '—'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>

            {/* Promotions */}
            <Card className="overflow-hidden">
              <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                Promotions
              </div>
              {d.promotions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 border-b border-border px-[18px] py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{p.label}</div>
                    <div className="truncate text-[11px] text-fg-subtle">{p.scopeLabel}</div>
                  </div>
                  <span className="flex-shrink-0 text-[12.5px] font-bold tabular-nums">
                    {p.type === 'percentage'
                      ? `-${p.value} %`
                      : p.type === 'amount'
                        ? `-${p.value} €`
                        : `+${p.value}`}
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-[7px] px-2 py-0.5 text-[11px] font-bold',
                      PROMO_META[p.status].cls,
                    )}
                  >
                    {PROMO_META[p.status].label}
                  </span>
                </div>
              ))}
              {d.promotions.length === 0 && (
                <div className="px-[18px] py-8 text-center text-[12.5px] text-fg-subtle">
                  Aucune promotion.
                </div>
              )}
            </Card>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
