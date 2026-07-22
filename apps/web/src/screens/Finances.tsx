import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, pct } from '@/lib/format';
import { Card, ProgressBar, ScreenHeader, StatCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

/** Finances — descriptive read-only consolidation (revenue, charges, margin per site). */
export function Finances() {
  const { t } = useTranslation();
  const api = useApi();
  const { isAll, label } = useScope();
  const query = useQuery({ queryKey: ['finance'], queryFn: () => api.getFinance() });

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.finances')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-1.5 text-[12.5px] text-fg-subtle">Période · {d.periodLabel}</div>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard
                label="CA consolidé"
                icon="euro"
                iconClass="text-primary"
                value={money0(d.consolidatedRevenue)}
              />
              <StatCard
                label="Charges"
                icon="bank"
                iconClass="text-warn"
                value={money0(d.charges)}
              />
              <StatCard
                label="Marge nette"
                icon="trendUp"
                iconClass="text-ok"
                value={money0(d.netMargin)}
              />
              <StatCard
                label="TVA collectée"
                icon="file"
                iconClass="text-info"
                value={money0(d.vatCollected)}
              />
            </div>

            {/* Marge par site */}
            <Card className="overflow-hidden">
              <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                Marge par site
              </div>
              <div className="grid grid-cols-[1.4fr_.9fr_.9fr_.9fr_.9fr] gap-2 border-b border-border px-[18px] py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                <div>Site</div>
                <div className="text-right">CA</div>
                <div className="text-right">Charges</div>
                <div className="text-right">Marge</div>
                <div className="text-right">%</div>
              </div>
              {d.margins.map((m) => (
                <div
                  key={m.siteId}
                  className="grid grid-cols-[1.4fr_.9fr_.9fr_.9fr_.9fr] items-center gap-2 border-b border-border px-[18px] py-2.5 last:border-b-0"
                >
                  <div className="truncate text-[12.5px] font-semibold">{m.siteName}</div>
                  <div className="text-right text-[12.5px] tabular-nums text-fg-muted">
                    {money0(m.revenue)}
                  </div>
                  <div className="text-right text-[12.5px] tabular-nums text-fg-muted">
                    {money0(m.charges)}
                  </div>
                  <div className="text-right text-[12.5px] font-semibold tabular-nums">
                    {money0(m.margin)}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <ProgressBar
                      value={m.marginPct}
                      tone={m.marginPct >= 30 ? 'ok' : m.marginPct >= 15 ? 'warn' : 'danger'}
                      className="w-16"
                    />
                    <span
                      className={cn(
                        'w-9 text-right text-[12px] font-bold tabular-nums',
                        m.marginPct >= 15 ? 'text-fg' : 'text-danger',
                      )}
                    >
                      {pct(m.marginPct, false)}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
