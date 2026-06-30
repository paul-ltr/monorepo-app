import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { Period, DashboardAlert, SiteKpi } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { money0, pct, num, relativeTime } from '@/lib/format';
import { Button, Card, Pill, ProgressBar, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { Sparkline } from '@/components/charts';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const PERIODS: { key: Period; labelKey: string }[] = [
  { key: 'today', labelKey: 'common.today' },
  { key: '7d', labelKey: 'common.d7' },
  { key: '30d', labelKey: 'common.d30' },
];

const ALERT_TONE: Record<string, { fg: string; bg: string }> = {
  critical: { fg: 'text-danger', bg: 'bg-danger-soft' },
  warning: { fg: 'text-warn', bg: 'bg-warn-soft' },
  info: { fg: 'text-info', bg: 'bg-info-soft' },
};
const SEV_LABEL: Record<string, string> = { critical: 'Critique', warning: 'Attention', info: 'Info' };

function siteDot(s: SiteKpi): string {
  if (s.openAlerts === 0) return 'var(--ok)';
  return s.openAlerts >= 3 ? 'var(--danger)' : 'var(--warn)';
}
function benchTone(p: number) {
  return p >= 75 ? 'ok' : p >= 45 ? 'warn' : 'danger';
}

export function Dashboard() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('today');
  const session = useSession();
  const orgName = session.data?.tenant.name ?? 'Groupe Lavéo';
  const query = useQuery({ queryKey: ['dashboard', period], queryFn: () => api.getDashboard(period) });
  const showAi = true;

  return (
    <>
      <ScreenHeader
        crumbs={[orgName, t('topbar.allSites')]}
        title={t('titles.dashboard')}
        actions={
          <>
            <div className="flex rounded-[10px] border border-border bg-surface p-[3px]">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'h-[30px] rounded-[7px] px-[13px] text-[12.5px] font-semibold',
                    period === p.key ? 'bg-primary text-primary-fg' : 'text-fg-muted',
                  )}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
            <Button variant="secondary" icon="download">
              {t('common.export')}
            </Button>
          </>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            {/* KPI row */}
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Card className="flex-[2.4_1_250px] p-4">
                <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-fg-muted">
                  <Icon name="euro" size={15} className="text-primary" strokeWidth={1.9} />
                  Recettes du jour
                </div>
                <div className="flex items-end gap-2.5">
                  <div className="whitespace-nowrap text-3xl font-bold tabular-nums tracking-[-1px]">
                    {money0(d.revenueToday)}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1 pb-[5px] text-[13px] font-bold',
                      d.revenueDelta.direction === 'down' ? 'text-danger' : 'text-ok',
                    )}
                  >
                    <Icon name="trendUp" size={14} strokeWidth={2.4} />
                    {pct(d.revenueDelta.pct)}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-fg-subtle">
                    vs hier · {money0(d.revenueYesterday)}
                  </span>
                  <Sparkline points={[27, 24, 26, 17, 20, 12, 15, 7, 5]} />
                </div>
              </Card>

              <KpiSmall
                icon="clock"
                iconClass="text-info"
                label="Machines actives"
                value={
                  <>
                    {d.machinesActive}
                    <span className="text-base font-semibold text-fg-subtle"> / {d.machinesTotal}</span>
                  </>
                }
              >
                <ProgressBar
                  className="mt-2.5 h-[5px]"
                  value={(d.machinesActive / d.machinesTotal) * 100}
                  tone="info"
                />
                <div className="mt-1.5 text-[11.5px] text-fg-subtle">
                  {Math.round((d.machinesActive / d.machinesTotal) * 100)} % du parc en service
                </div>
              </KpiSmall>

              <KpiSmall icon="power" iconClass="text-danger" label="Hors service" valueClass="text-danger" value={d.machinesOutOfService}>
                <Pill tone="danger" className="mt-3">
                  {d.sitesWithOosCount} sites concernés
                </Pill>
              </KpiSmall>

              <KpiSmall icon="leaf" iconClass="text-energy" label="Énergie vs réf." valueClass="text-energy" value={pct(d.energyVsRefPct)}>
                <div className="mt-3 text-[11.5px] text-fg-subtle">Sous la référence du parc</div>
              </KpiSmall>

              <KpiSmall icon="wrench" iconClass="text-warn" label="Tickets ouverts" value={d.openTickets}>
                <Pill tone="warn" className="mt-3">
                  {d.criticalTickets} critiques
                </Pill>
              </KpiSmall>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
              <SectionCard
                title="Performance par site"
                subtitle="Comparatif sur les 6 sites · benchmark percentile vs pairs"
                action={
                  <button onClick={() => navigate({ to: '/reseau' })} className="text-[12.5px] font-semibold text-primary">
                    {t('common.seeNetwork')}
                  </button>
                }
              >
                <div className="grid grid-cols-[1.6fr_.8fr_.9fr_.7fr_1.1fr_.6fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                  <div>Site</div>
                  <div className="text-right">CA jour</div>
                  <div>Occupation</div>
                  <div className="text-right">Uptime</div>
                  <div>Benchmark</div>
                  <div className="text-center">Alertes</div>
                </div>
                {d.sites.map((s) => (
                  <div
                    key={s.siteId}
                    className="grid cursor-pointer grid-cols-[1.6fr_.8fr_.9fr_.7fr_1.1fr_.6fr] items-center gap-2 border-b border-border px-[18px] py-3 hover:bg-surface-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: siteDot(s) }} />
                      <span className="truncate text-[13px] font-semibold">{s.name}</span>
                    </div>
                    <div className="text-right text-[13px] font-bold tabular-nums">{money0(s.revenue)}</div>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.occupancyPct} tone="info" className="flex-1" />
                      <span className="w-[30px] text-right text-[11.5px] tabular-nums text-fg-muted">{s.occupancyPct}%</span>
                    </div>
                    <div
                      className={cn(
                        'text-right text-[12.5px] font-semibold tabular-nums',
                        s.uptimePct >= 95 ? 'text-ok' : s.uptimePct >= 85 ? 'text-warn' : 'text-danger',
                      )}
                    >
                      {s.uptimePct}%
                    </div>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.benchmarkPercentile} tone={benchTone(s.benchmarkPercentile)} className="flex-1" />
                      <span className="w-[34px] text-right text-[11px] tabular-nums text-fg-subtle">
                        P{s.benchmarkPercentile}
                      </span>
                    </div>
                    <div className="text-center">
                      <span
                        className={cn(
                          'inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[7px] px-1.5 text-[11.5px] font-bold tabular-nums',
                          s.openAlerts === 0
                            ? 'bg-surface-3 text-fg-subtle'
                            : s.openAlerts >= 3
                              ? 'bg-danger-soft text-danger'
                              : 'bg-warn-soft text-warn',
                        )}
                      >
                        {s.openAlerts}
                      </span>
                    </div>
                  </div>
                ))}
              </SectionCard>

              <div className="flex flex-col gap-[18px]">
                {showAi && <AiSynthesis />}
                <SectionCard
                  title={
                    <span className="flex items-center gap-2">
                      Alertes prioritaires
                      <span className="rounded-[8px] bg-danger px-[7px] py-px text-[11px] font-bold tabular-nums text-white">
                        {d.alerts.filter((a) => a.severity !== 'info').length}
                      </span>
                    </span>
                  }
                  action={<button className="text-xs font-semibold text-primary">{t('common.seeAll')}</button>}
                >
                  {d.alerts.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </SectionCard>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}

function KpiSmall({
  icon,
  iconClass,
  label,
  value,
  valueClass,
  children,
}: {
  icon: IconName;
  iconClass: string;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex-[1_1_158px] p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
        <Icon name={icon} size={14} className={iconClass} strokeWidth={1.9} />
        {label}
      </div>
      <div className={cn('text-[26px] font-bold tabular-nums tracking-[-0.5px]', valueClass)}>{value}</div>
      {children}
    </Card>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const tone = ALERT_TONE[alert.severity]!;
  return (
    <div className="flex cursor-pointer gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0 hover:bg-surface-2">
      <div className={cn('flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px]', tone.bg, tone.fg)}>
        <Icon name={alert.icon} size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-[1.35]">{alert.title}</div>
        <div className="mt-[3px] flex items-center gap-1.5">
          <span className={cn('text-[11px] font-semibold uppercase tracking-[0.2px]', tone.fg)}>
            {SEV_LABEL[alert.severity]}
          </span>
          <span className="text-[11px] text-fg-subtle">
            · {alert.siteName} · {relativeTime(alert.at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AiSynthesis() {
  return (
    <Card
      className="relative overflow-hidden p-4"
      // gradient backdrop from the design
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg,var(--primary-soft),var(--surface))' }}
      />
      <div className="relative">
        <div className="mb-[11px] flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-primary">
            <Icon name="sparkles" size={15} className="text-white" />
          </div>
          <div className="flex-1 text-[13.5px] font-bold">Synthèse IA</div>
          <span className="rounded-[6px] border border-border bg-surface px-[7px] py-[3px] text-[10px] font-semibold text-fg-subtle">
            généré automatiquement
          </span>
        </div>
        <p className="m-0 text-[13px] leading-[1.6]">
          Le site <strong>Vénissieux Centre</strong> a sous-performé de <strong>−31 %</strong> cette semaine, probablement
          lié à <strong>2 sèche-linge HS depuis mardi</strong> et une surconsommation d'eau. À l'inverse,{' '}
          <strong>Lyon-3</strong> dépasse son objectif de +12 %.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <a className="cursor-pointer rounded-[7px] border border-border bg-surface px-[9px] py-[5px] text-[11.5px] font-semibold text-primary">
            → Ouvrir Vénissieux
          </a>
          <a className="cursor-pointer rounded-[7px] border border-border bg-surface px-[9px] py-[5px] text-[11.5px] font-semibold text-primary">
            → 2 tickets liés
          </a>
        </div>
        <div className="mt-[13px] flex items-center gap-2 border-t border-border pt-3">
          <span className="flex-1 text-[11px] text-fg-subtle">Cette synthèse vous est-elle utile ?</span>
          <button className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-surface text-fg-muted hover:border-ok hover:text-ok">
            <Icon name="thumbsUp" size={14} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-surface text-fg-muted hover:border-danger hover:text-danger">
            <Icon name="thumbsUp" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>
    </Card>
  );
}
