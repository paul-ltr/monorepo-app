import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MachineState } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, num } from '@/lib/format';
import { Card, ScreenHeader, StatCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const STATE_META: Record<MachineState, { label: string; dot: string; text: string }> = {
  free: { label: 'Libre', dot: 'bg-ok', text: 'text-ok' },
  running: { label: 'En cycle', dot: 'bg-info', text: 'text-info' },
  finished: { label: 'À vider', dot: 'bg-warn', text: 'text-warn' },
  out_of_service: { label: 'Hors service', dot: 'bg-danger', text: 'text-danger' },
  offline: { label: 'Hors ligne', dot: 'bg-fg-subtle', text: 'text-fg-subtle' },
};
const ORDER: MachineState[] = ['free', 'running', 'finished', 'out_of_service', 'offline'];

/** Machines & supervision — descriptive read-only view of the current park. */
export function Machines() {
  const { t } = useTranslation();
  const api = useApi();
  const { scope, sites, isAll, label } = useScope();
  const query = useQuery({
    queryKey: ['machines', 'status'],
    queryFn: () => api.getMachineStatuses(),
  });

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.machines')} />

      <QueryBoundary query={query}>
        {(d) => {
          const items =
            scope.type === 'site' ? d.items.filter((m) => m.siteId === scope.siteId) : d.items;
          const counts = ORDER.reduce<Record<string, number>>((acc, s) => {
            acc[s] = items.filter((m) => m.state === s).length;
            return acc;
          }, {});
          const total = items.length;
          const active = (counts.free ?? 0) + (counts.running ?? 0);

          return (
            <>
              <div className="mb-[18px] flex flex-wrap gap-3.5">
                <StatCard label="Parc total" icon="washer" iconClass="text-primary" value={total} />
                <StatCard
                  label="Actives"
                  icon="clock"
                  iconClass="text-ok"
                  value={active}
                  footer={`${total ? Math.round((active / total) * 100) : 0} % du parc`}
                />
                <StatCard
                  label="En cycle"
                  icon="clock"
                  iconClass="text-info"
                  value={counts.running ?? 0}
                />
                <StatCard
                  label="Hors service"
                  icon="power"
                  iconClass="text-danger"
                  value={(counts.out_of_service ?? 0) + (counts.offline ?? 0)}
                />
              </div>

              {/* Répartition des états */}
              <Card className="mb-[18px] p-[18px_20px]">
                <div className="mb-3 text-[15px] font-bold">Répartition des états</div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
                  {ORDER.map((s) =>
                    counts[s] ? (
                      <div
                        key={s}
                        className={STATE_META[s].dot}
                        style={{ width: `${(counts[s]! / Math.max(1, total)) * 100}%` }}
                        title={`${STATE_META[s].label} · ${counts[s]}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {ORDER.map((s) => (
                    <div key={s} className="flex items-center gap-1.5 text-[12px]">
                      <span className={cn('h-2 w-2 rounded-full', STATE_META[s].dot)} />
                      <span className="text-fg-muted">{STATE_META[s].label}</span>
                      <span className="font-bold tabular-nums">{counts[s] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Machine list */}
              <Card className="overflow-hidden">
                <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                  Machines
                </div>
                <div className="grid grid-cols-[1fr_1.2fr_1fr_.7fr_.8fr] gap-2 border-b border-border px-[18px] py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                  <div>Machine</div>
                  <div>Site</div>
                  <div>État</div>
                  <div className="text-right">Cycles</div>
                  <div className="text-right">CA jour</div>
                </div>
                {items.map((m) => (
                  <div
                    key={m.machineId}
                    className="grid grid-cols-[1fr_1.2fr_1fr_.7fr_.8fr] items-center gap-2 border-b border-border px-[18px] py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold">{m.code}</div>
                      <div className="truncate text-[11px] text-fg-subtle">{m.name}</div>
                    </div>
                    <div className="truncate text-[12px] text-fg-muted">
                      {sites.find((s) => s.id === m.siteId)?.name ?? m.siteName}
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-[12px] font-semibold',
                        STATE_META[m.state].text,
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', STATE_META[m.state].dot)} />
                      {STATE_META[m.state].label}
                    </div>
                    <div className="text-right text-[12.5px] tabular-nums">
                      {num(m.cyclesToday)}
                    </div>
                    <div className="text-right text-[12.5px] font-semibold tabular-nums">
                      {money0(m.revenueToday)}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="px-[18px] py-8 text-center text-[12.5px] text-fg-subtle">
                    Aucune machine sur ce périmètre.
                  </div>
                )}
              </Card>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
