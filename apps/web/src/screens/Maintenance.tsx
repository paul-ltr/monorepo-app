import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TicketPriority, TicketStatus, TechnicianTask } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { num } from '@/lib/format';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const PRIO: Record<TicketPriority, { label: string; c: string; bg: string }> = {
  critical: { label: 'critique', c: 'text-danger', bg: 'bg-danger-soft' },
  high: { label: 'haute', c: 'text-danger', bg: 'bg-danger-soft' },
  medium: { label: 'moyenne', c: 'text-warn', bg: 'bg-warn-soft' },
  low: { label: 'basse', c: 'text-info', bg: 'bg-info-soft' },
};
const PRIO_BAR: Record<TicketPriority, string> = {
  critical: 'bg-danger',
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-info',
};
const STATUS: Record<TicketStatus, { label: string; c: string }> = {
  open: { label: 'Ouvert', c: 'text-danger' },
  assigned: { label: 'Affecté', c: 'text-warn' },
  in_progress: { label: 'En cours', c: 'text-info' },
  resolved: { label: 'Résolu', c: 'text-ok' },
  closed: { label: 'Fermé', c: 'text-fg-subtle' },
};
const SOURCE: Record<string, string> = { alarm: 'Alarme', customer: 'Client', operator: 'Opérateur', plan: 'Plan' };
const WORK: Record<TechnicianTask['status'], { label: string; c: string; bg: string }> = {
  en_route: { label: 'En route', c: 'text-info', bg: 'bg-info-soft' },
  planned: { label: 'Planifié', c: 'text-fg-muted', bg: 'bg-surface-3' },
  to_confirm: { label: 'À confirmer', c: 'text-warn', bg: 'bg-warn-soft' },
  done: { label: 'Terminé', c: 'text-ok', bg: 'bg-ok-soft' },
};
const PLAN_URGENCY: Record<string, string> = { ok: 'text-ok', soon: 'text-warn', overdue: 'text-danger' };

export function Maintenance() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['maintenance'], queryFn: () => api.getMaintenance() });

  return (
    <>
      <ScreenHeader
        crumbs={[t('topbar.allSites'), 'GMAO']}
        title={t('titles.maintenance')}
        actions={
          <Button variant="primary" icon="plus">
            Nouveau ticket
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <KpiCard label="Tickets ouverts" value={d.openTickets} foot={<span className="inline-flex rounded-[7px] bg-danger-soft px-2 py-[3px] text-[11px] font-semibold text-danger">{d.criticalTickets} critiques</span>} />
              <KpiCard label="MTTR moyen" value={<>{num(d.mttrHours)} <span className="text-sm font-semibold text-fg-subtle">h</span></>} foot={<span className="text-[11.5px] font-semibold text-ok">−18 % vs mois préc.</span>} />
              <KpiCard label="MTBF moyen" value={<>{d.mtbfDays} <span className="text-sm font-semibold text-fg-subtle">j</span></>} foot={<span className="text-[11.5px] text-fg-subtle">Entre défaillances</span>} />
              <KpiCard label="Disponibilité parc" value={`${num(d.availabilityPct)} %`} valueClass="text-ok" foot={<span className="text-[11.5px] text-fg-subtle">{d.machinesTracked} machines suivies</span>} />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.65fr_1fr]">
              <SectionCard title="File de tickets · priorisée">
                {d.tickets.map((tk) => {
                  const prio = PRIO[tk.priority];
                  const st = STATUS[tk.status];
                  return (
                    <div key={tk.id} className="flex cursor-pointer items-center gap-[13px] border-b border-border px-[18px] py-[13px] last:border-b-0 hover:bg-surface-2">
                      <span className={cn('h-[34px] w-1 flex-shrink-0 rounded-[3px]', PRIO_BAR[tk.priority])} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{tk.title}</div>
                        <div className="mt-0.5 font-mono text-[11.5px] text-fg-subtle">
                          {tk.code} · {tk.siteName} · {SOURCE[tk.source]}
                        </div>
                      </div>
                      <span className={cn('rounded-[7px] px-[9px] py-[3px] text-[11px] font-bold capitalize', prio.c, prio.bg)}>{prio.label}</span>
                      <div className="w-[90px] flex-shrink-0 text-right">
                        <div className={cn('text-xs font-semibold', st.c)}>{st.label}</div>
                        <div className="text-[11px] text-fg-subtle">{tk.slaLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </SectionCard>

              <div className="flex flex-col gap-[18px]">
                <SectionCard title="Tournée du jour">
                  {d.worklist.map((w, i) => {
                    const ws = WORK[w.status];
                    return (
                      <div key={i} className="flex gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0">
                        <div className="w-[38px] flex-shrink-0 font-mono text-xs font-semibold text-fg-muted">{w.time}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold leading-[1.35]">{w.task}</div>
                          <div className="mt-0.5 text-[11px] text-fg-subtle">
                            {w.technicianName} · {w.siteName}
                          </div>
                        </div>
                        <span className={cn('h-fit whitespace-nowrap rounded-[6px] px-[7px] py-[3px] text-[10.5px] font-bold', ws.c, ws.bg)}>{ws.label}</span>
                      </div>
                    );
                  })}
                </SectionCard>

                <Card className="p-4">
                  <div className="mb-2.5 text-sm font-bold">Plan préventif</div>
                  {d.plans.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border py-2 text-[12.5px] last:border-b-0">
                      <span className="text-fg-muted">{p.label}</span>
                      <span className={cn('font-semibold', PLAN_URGENCY[p.urgency])}>{p.dueLabel}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}

function KpiCard({ label, value, valueClass, foot }: { label: string; value: React.ReactNode; valueClass?: string; foot?: React.ReactNode }) {
  return (
    <Card className="flex-[1_1_160px] p-4">
      <div className="text-[12.5px] font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 text-[26px] font-bold tabular-nums', valueClass)}>{value}</div>
      {foot && <div className="mt-2">{foot}</div>}
    </Card>
  );
}
