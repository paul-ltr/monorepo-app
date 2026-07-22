import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '@/lib/api';
import { money0, pct } from '@/lib/format';
import { Card, ProgressBar, ScreenHeader, StatCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

function benchTone(p: number) {
  return p >= 75 ? 'ok' : p >= 45 ? 'warn' : 'danger';
}

/** Réseau & benchmark — descriptive read-only ranking across sites. */
export function Reseau() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['network'], queryFn: () => api.getNetwork() });

  return (
    <>
      <ScreenHeader crumbs={[t('topbar.allSites')]} title={t('titles.reseau')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard
                label="CA réseau (30 j)"
                icon="euro"
                iconClass="text-primary"
                value={money0(d.revenue30d)}
              />
              <StatCard
                label="Indice benchmark"
                icon="trendUp"
                iconClass="text-info"
                value={`P${d.benchmarkIndex}`}
              />
              <StatCard
                label="Sites en alerte"
                icon="alert"
                iconClass="text-danger"
                value={d.sitesInAlert}
              />
              <StatCard
                label="Redevances"
                icon="bank"
                iconClass="text-energy"
                value={money0(d.royaltiesDue)}
                footer={d.royaltyBasisLabel}
              />
            </div>

            {d.exception && (
              <Card className="mb-[18px] flex items-center gap-2.5 border-warn bg-warn-soft/40 p-[14px_18px]">
                <Icon name="alert" size={16} className="text-warn" strokeWidth={2} />
                <span className="text-[12.5px]">
                  <strong>{d.exception.siteName}</strong> · {d.exception.message}
                </span>
              </Card>
            )}

            {/* Classement des sites */}
            <Card className="overflow-hidden">
              <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                Classement des sites
              </div>
              <div className="grid grid-cols-[40px_1.6fr_1fr_1.2fr_.7fr] gap-2 border-b border-border px-[18px] py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                <div>#</div>
                <div>Site</div>
                <div className="text-right">CA</div>
                <div>Benchmark</div>
                <div className="text-right">vs réf.</div>
              </div>
              {d.ranking.map((r) => (
                <div
                  key={r.siteId}
                  className="grid grid-cols-[40px_1.6fr_1fr_1.2fr_.7fr] items-center gap-2 border-b border-border px-[18px] py-2.5 last:border-b-0"
                >
                  <div className="text-[13px] font-bold tabular-nums text-fg-subtle">{r.rank}</div>
                  <div className="truncate text-[12.5px] font-semibold">{r.name}</div>
                  <div className="text-right text-[12.5px] font-semibold tabular-nums">
                    {money0(r.revenue)}
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={r.index} tone={benchTone(r.index)} className="flex-1" />
                    <span className="w-8 text-right text-[11px] tabular-nums text-fg-subtle">
                      P{r.index}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-right text-[12px] font-bold tabular-nums',
                      r.deltaPct < 0 ? 'text-danger' : 'text-ok',
                    )}
                  >
                    {pct(r.deltaPct)}
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
