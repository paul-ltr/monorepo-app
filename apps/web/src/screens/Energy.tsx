import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { EnergyMeter } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { num, pct } from '@/lib/format';
import { Card, ScreenHeader } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { MiniBars } from '@/components/charts';
import { cn } from '@/lib/cn';

const METER_META: Record<
  string,
  { label: string; icon: IconName; iconClass: string; barColor: string; barLast: string }
> = {
  electricity: {
    label: 'Électricité',
    icon: 'bolt',
    iconClass: 'text-warn',
    barColor: 'var(--warn-soft)',
    barLast: 'var(--warn)',
  },
  gas: {
    label: 'Gaz',
    icon: 'flame',
    iconClass: 'text-danger',
    barColor: 'var(--energy-soft)',
    barLast: 'var(--energy)',
  },
  water: {
    label: 'Eau',
    icon: 'droplet',
    iconClass: 'text-info',
    barColor: 'var(--info-soft)',
    barLast: 'var(--info)',
  },
};

/** Loose match between an energy heatmap row and a site name. */
const sameSite = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

/**
 * Énergie — deliberately simplified to a descriptive view (we iterate later):
 * the global consumption from gas and/or electricity, plus the consumption
 * history. No OPERAT, no user actions — just a standardised way to show the data
 * the chat can draw on.
 */
export function Energy() {
  const { t } = useTranslation();
  const api = useApi();
  const { scope, sites, isAll, label } = useScope();
  const query = useQuery({ queryKey: ['energy'], queryFn: () => api.getEnergy() });

  const activeSite = scope.type === 'site' ? sites.find((s) => s.id === scope.siteId) : undefined;
  const totalSurface = sites.reduce((s, x) => s + (x.surfaceM2 ?? 0), 0);
  // When one site is active, scale the network meters down to its surface share.
  const surfaceFrac = activeSite
    ? activeSite.surfaceM2 && totalSurface
      ? activeSite.surfaceM2 / totalSurface
      : 1 / Math.max(1, sites.length)
    : 1;

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.energy')} />

      <QueryBoundary query={query}>
        {(d) => {
          const meters = (
            activeSite
              ? d.meters.map((m) => ({
                  ...m,
                  value: Math.round(m.value * surfaceFrac * 10) / 10,
                  live: false,
                }))
              : d.meters
          ).filter((m) => m.kind === 'electricity' || m.kind === 'gas');

          const elec = meters.find((m) => m.kind === 'electricity');
          const gas = meters.find((m) => m.kind === 'gas');
          const total = (elec?.value ?? 0) + (gas?.value ?? 0);

          // Consumption history: aggregate the intensity heatmap into a monthly
          // series across the current perimeter (single site or the whole park).
          const rows = activeSite
            ? d.heatmap.filter((r) => sameSite(r.siteName, activeSite.name))
            : d.heatmap;
          const history = d.heatmapMonths.map((month, i) => {
            const vals = rows.map((r) => r.cells[i] ?? 0);
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            // Express as an indicative kWh/m²/month figure (same scale as before).
            return { month, value: Math.round(120 + avg * 110) };
          });
          const histMax = Math.max(1, ...history.map((h) => h.value));

          return (
            <>
              {/* Global consumption */}
              <Card className="mb-[18px] p-[18px_20px]">
                <div className="mb-1 flex items-center gap-2">
                  <Icon name="leaf" size={17} className="text-energy" strokeWidth={2} />
                  <div className="text-[15px] font-bold">Consommation globale</div>
                  <span className="ml-auto text-[12px] text-fg-subtle">
                    {isAll ? `${sites.length} sites` : label}
                  </span>
                </div>
                <div className="text-[12.5px] text-fg-subtle">
                  Énergie consommée (électricité + gaz) sur la période.
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="text-[36px] font-bold leading-none tabular-nums tracking-[-1.5px] text-energy">
                    {num(Math.round(total))}
                  </div>
                  <div className="pb-1 text-[14px] font-semibold text-fg-subtle">kWh</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {elec && (
                    <Breakdown
                      label="Électricité"
                      value={elec.value}
                      unit={elec.unit}
                      delta={elec.deltaPct}
                      color="text-warn"
                    />
                  )}
                  {gas && (
                    <Breakdown
                      label="Gaz"
                      value={gas.value}
                      unit={gas.unit}
                      delta={gas.deltaPct}
                      color="text-danger"
                    />
                  )}
                </div>
              </Card>

              {/* Per-source cards */}
              <div className="mb-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {meters.map((m) => (
                  <MeterCard key={m.kind} m={m} estimated={!!activeSite} />
                ))}
              </div>

              {/* Consumption history */}
              <Card className="p-[18px_20px]">
                <div className="mb-1 text-[15px] font-bold">Historique de consommation</div>
                <div className="mb-4 text-xs text-fg-subtle">
                  Intensité énergétique mensuelle · kWh/m²/mois
                </div>
                {history.length === 0 ? (
                  <div className="py-6 text-center text-[12.5px] text-fg-subtle">
                    Aucune donnée pour ce périmètre.
                  </div>
                ) : (
                  <div className="flex h-[180px] items-end gap-2">
                    {history.map((h) => (
                      <div key={h.month} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="text-[11px] font-semibold tabular-nums text-fg-muted">
                          {h.value}
                        </div>
                        <div
                          className="w-full rounded-t-[6px] bg-energy transition-all"
                          style={{
                            height: `${(h.value / histMax) * 130}px`,
                            opacity: 0.55 + 0.45 * (h.value / histMax),
                          }}
                        />
                        <div className="text-[11px] font-semibold text-fg-subtle">{h.month}</div>
                      </div>
                    ))}
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

function Breakdown({
  label,
  value,
  unit,
  delta,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  delta: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3 py-2">
      <span className="text-[12px] font-semibold text-fg-muted">{label}</span>
      <span className={cn('text-[14px] font-bold tabular-nums', color)}>
        {num(value)} <span className="text-[11px] font-medium text-fg-subtle">{unit}</span>
      </span>
      <span className={cn('text-[11.5px] font-bold', delta <= 0 ? 'text-ok' : 'text-danger')}>
        {pct(delta)}
      </span>
    </div>
  );
}

function MeterCard({ m, estimated }: { m: EnergyMeter; estimated: boolean }) {
  const meta = METER_META[m.kind]!;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-muted">
          <Icon name={meta.icon} size={15} className={meta.iconClass} strokeWidth={1.9} />
          {meta.label}
          {estimated && (
            <span className="rounded-[6px] bg-surface-3 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-fg-subtle">
              estimation
            </span>
          )}
        </div>
        <span
          className={cn('text-[11.5px] font-bold', m.deltaPct <= 0 ? 'text-ok' : 'text-danger')}
        >
          {pct(m.deltaPct)}
        </span>
      </div>
      <div className="mt-2 text-[25px] font-bold tabular-nums tracking-[-0.5px]">
        {num(m.value)} <span className="text-sm font-semibold text-fg-subtle">{m.unit}</span>
      </div>
      {m.series.length > 0 ? (
        <MiniBars values={m.series} color={meta.barColor} lastColor={meta.barLast} />
      ) : (
        <div className="mt-2.5 text-[11.5px] text-fg-subtle">
          Historique en cours d’acquisition.
        </div>
      )}
    </Card>
  );
}
