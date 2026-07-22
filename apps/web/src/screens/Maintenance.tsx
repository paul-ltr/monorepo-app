import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TicketPriority, TicketStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { Card, ScreenHeader, StatCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const PRIORITY_META: Record<TicketPriority, { label: string; cls: string }> = {
  critical: { label: 'Critique', cls: 'bg-danger-soft text-danger' },
  high: { label: 'Haute', cls: 'bg-warn-soft text-warn' },
  medium: { label: 'Moyenne', cls: 'bg-info-soft text-info' },
  low: { label: 'Basse', cls: 'bg-surface-3 text-fg-subtle' },
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Ouvert',
  assigned: 'Assigné',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Clôturé',
};
const URGENCY_DOT: Record<string, string> = { overdue: 'bg-danger', soon: 'bg-warn', ok: 'bg-ok' };

/** Maintenance & GMAO — descriptive read-only view (tickets + preventive plan). */
export function Maintenance() {
  const { t } = useTranslation();
  const api = useApi();
  const { isAll, label } = useScope();
  const query = useQuery({ queryKey: ['maintenance'], queryFn: () => api.getMaintenance() });

  return (
    <>
      <ScreenHeader
        crumbs={[isAll ? t('topbar.allSites') : label]}
        title={t('titles.maintenance')}
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard
                label="Tickets ouverts"
                icon="wrench"
                iconClass="text-warn"
                value={d.openTickets}
                footer={`${d.criticalTickets} critiques`}
              />
              <StatCard
                label="Disponibilité"
                icon="check"
                iconClass="text-ok"
                value={`${d.availabilityPct} %`}
              />
              <StatCard
                label="MTTR"
                icon="clock"
                iconClass="text-info"
                value={`${d.mttrHours} h`}
                footer={`MTBF ${d.mtbfDays} j`}
              />
              <StatCard
                label="Machines suivies"
                icon="washer"
                iconClass="text-fg-muted"
                value={d.machinesTracked}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.6fr_1fr]">
              {/* Tickets */}
              <Card className="overflow-hidden">
                <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                  Tickets
                </div>
                {d.tickets.map((tk) => (
                  <div
                    key={tk.id}
                    className="flex items-center gap-3 border-b border-border px-[18px] py-3 last:border-b-0"
                  >
                    <span
                      className={cn(
                        'rounded-[7px] px-2 py-0.5 text-[11px] font-bold',
                        PRIORITY_META[tk.priority].cls,
                      )}
                    >
                      {PRIORITY_META[tk.priority].label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold">
                        <span className="font-mono text-fg-subtle">{tk.code}</span> · {tk.title}
                      </div>
                      <div className="truncate text-[11px] text-fg-subtle">
                        {tk.siteName}
                        {tk.machineCode ? ` · ${tk.machineCode}` : ''} · {tk.slaLabel}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-[11.5px] font-semibold text-fg-muted">
                      {STATUS_LABEL[tk.status]}
                    </span>
                  </div>
                ))}
                {d.tickets.length === 0 && (
                  <div className="px-[18px] py-8 text-center text-[12.5px] text-fg-subtle">
                    Aucun ticket ouvert.
                  </div>
                )}
              </Card>

              {/* Plan préventif */}
              <Card className="overflow-hidden">
                <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                  Plan préventif
                </div>
                {d.plans.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 border-b border-border px-[18px] py-3 last:border-b-0"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 flex-shrink-0 rounded-full',
                        URGENCY_DOT[p.urgency] ?? 'bg-ok',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {p.label}
                    </span>
                    <span className="flex-shrink-0 text-[11.5px] font-semibold text-fg-muted">
                      {p.dueLabel}
                    </span>
                  </div>
                ))}
                {d.plans.length === 0 && (
                  <div className="flex items-center gap-2 px-[18px] py-6 text-[12.5px] text-fg-subtle">
                    <Icon name="check" size={15} className="text-ok" /> Plan à jour.
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
