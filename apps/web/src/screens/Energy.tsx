import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { EnergyMeter } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { num, pct } from '@/lib/format';
import { Button, Card, ScreenHeader } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { Gauge, MiniBars, heatCellStyle } from '@/components/charts';
import { cn } from '@/lib/cn';

const METER_META: Record<string, { label: string; icon: IconName; iconClass: string; barColor: string; barLast: string }> = {
  electricity: { label: 'Électricité', icon: 'bolt', iconClass: 'text-warn', barColor: 'var(--warn-soft)', barLast: 'var(--warn)' },
  water: { label: 'Eau', icon: 'droplet', iconClass: 'text-info', barColor: 'var(--info-soft)', barLast: 'var(--info)' },
  gas: { label: 'Gaz', icon: 'flame', iconClass: 'text-danger', barColor: 'var(--energy-soft)', barLast: 'var(--energy)' },
};

export function Energy() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['energy'], queryFn: () => api.getEnergy() });
  const generate = useMutation({ mutationFn: () => api.generateOperat(new Date().getFullYear()) });

  return (
    <>
      <ScreenHeader
        crumbs={[t('topbar.allSites'), <span className="text-energy">Décret tertiaire · OPERAT</span>]}
        title={t('titles.energy')}
        actions={
          <Button variant="energy" icon="file" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isSuccess ? 'Dossier généré ✓' : generate.isPending ? 'Génération…' : 'Générer le dossier OPERAT'}
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] grid grid-cols-1 items-stretch gap-[18px] lg:grid-cols-[1.25fr_1fr]">
              <Card className="p-[18px_20px]">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[15px] font-bold">Trajectoire OPERAT — décret tertiaire</div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-[8px] px-[11px] py-[5px] text-xs font-bold',
                      d.trajectory.onTrack ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn',
                    )}
                  >
                    <Icon name="check" size={13} strokeWidth={2.4} />
                    {d.trajectory.onTrack ? 'Sur trajectoire' : 'À surveiller'}
                  </span>
                </div>
                <div className="mb-1.5 text-[12.5px] text-fg-subtle">
                  Consommation actuelle vs objectifs de réduction 2030 / 2040 / 2050
                </div>
                <div className="relative">
                  <Gauge value={Math.abs(d.trajectory.reductionPct)} max={60} />
                  <div className="absolute bottom-1.5 left-0 right-0 text-center">
                    <div className="text-[38px] font-bold leading-none tabular-nums tracking-[-1.5px] text-energy">
                      {pct(d.trajectory.reductionPct)}
                    </div>
                    <div className="mt-[3px] text-xs text-fg-subtle">
                      {num(d.trajectory.currentKwhM2Year)} kWh/m²/an · base {num(d.trajectory.baseKwhM2Year)}
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 flex gap-2.5">
                  {d.trajectory.targets.map((tg) => (
                    <div
                      key={tg.year}
                      className={cn(
                        'flex-1 rounded-[10px] p-[10px_8px] text-center',
                        tg.status === 'reached' ? 'bg-ok-soft' : 'border border-border bg-surface-2',
                      )}
                    >
                      <div className="text-[11px] font-semibold text-fg-muted">
                        {tg.year} · {tg.reductionPct} %
                      </div>
                      <div
                        className={cn(
                          'mt-0.5 text-[12.5px] font-bold',
                          tg.status === 'reached' ? 'text-ok' : 'text-fg-muted',
                        )}
                      >
                        {tg.status === 'reached' ? 'Atteint ✓' : `${tg.gapPts} pts`}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-col p-[18px_20px]">
                <div className="mb-[3px] text-[15px] font-bold">Dossier OPERAT 2025</div>
                <div className="mb-3.5 text-[12.5px] text-fg-subtle">
                  Déclaration annuelle sur la plateforme ADEME — prête à générer pour vos {d.siteCount} sites.
                </div>
                <div
                  className="flex min-h-[150px] flex-1 flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed border-border-strong p-6"
                  style={{
                    background:
                      'repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2) 9px,var(--surface-3) 9px,var(--surface-3) 18px)',
                  }}
                >
                  <Icon name="file" size={30} className="text-fg-subtle" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] text-fg-subtle">aperçu_dossier_operat.pdf · {d.siteCount} sites</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11.5px] text-fg-subtle">
                  <Icon name="check" size={14} className="text-ok" strokeWidth={2} />
                  Surfaces déclarées · données énergie consolidées
                </div>
              </Card>
            </div>

            <div className="mb-[18px] flex flex-wrap gap-3.5">
              {d.meters.map((m) => (
                <MeterCard key={m.kind} m={m} />
              ))}
            </div>

            <Card className="p-[18px_20px]">
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="text-[15px] font-bold">Intensité énergétique par site</div>
                  <div className="mt-0.5 text-xs text-fg-subtle">kWh/m²/mois · plus foncé = consommation plus élevée</div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <span>Faible</span>
                  <div
                    className="h-2 w-[90px] rounded-[4px]"
                    style={{ background: 'linear-gradient(90deg,rgba(12,133,121,.12),rgba(12,133,121,.95))' }}
                  />
                  <span>Élevée</span>
                </div>
              </div>
              <div className="grid grid-cols-[130px_repeat(6,1fr)] items-center gap-[5px]">
                <div />
                {d.heatmapMonths.map((mo) => (
                  <div key={mo} className="text-center text-[11px] font-semibold text-fg-subtle">
                    {mo}
                  </div>
                ))}
                {d.heatmap.map((row) => (
                  <Row key={row.siteName} name={row.siteName} cells={row.cells} />
                ))}
              </div>
            </Card>
          </>
        )}
      </QueryBoundary>
    </>
  );
}

function Row({ name, cells }: { name: string; cells: number[] }) {
  return (
    <>
      <div className="truncate text-xs font-semibold">{name}</div>
      {cells.map((v, i) => {
        const s = heatCellStyle(v);
        return (
          <div
            key={i}
            className="flex h-[34px] items-center justify-center rounded-[6px] text-[10.5px] font-semibold tabular-nums"
            style={{ background: s.background, color: s.color }}
          >
            {Math.round(120 + v * 110)}
          </div>
        );
      })}
    </>
  );
}

function MeterCard({ m }: { m: EnergyMeter }) {
  const meta = METER_META[m.kind]!;
  return (
    <Card className="flex-[1_1_220px] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-muted">
          <Icon name={meta.icon} size={15} className={meta.iconClass} strokeWidth={1.9} />
          {meta.label}
        </div>
        <span className={cn('text-[11.5px] font-bold', m.deltaPct <= 0 ? 'text-ok' : 'text-danger')}>{pct(m.deltaPct)}</span>
      </div>
      <div className="mt-2 text-[25px] font-bold tabular-nums tracking-[-0.5px]">
        {num(m.value)} <span className="text-sm font-semibold text-fg-subtle">{m.unit}</span>
      </div>
      {m.anomaly ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-[8px] bg-danger-soft px-[9px] py-1.5 text-[11.5px] font-semibold text-danger">
          <Icon name="alert" size={13} strokeWidth={2} />
          {m.anomaly}
        </div>
      ) : (
        <MiniBars values={m.series} color={meta.barColor} lastColor={meta.barLast} />
      )}
    </Card>
  );
}
