import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  MachineStatus,
  MaintenancePlanItem,
  Site,
  TechnicianTask,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { useSession } from '@/lib/hooks';
import { useAppParams } from '@/lib/params';
import { num } from '@/lib/format';
import { Button, Card, Modal, ScreenHeader, SectionCard, Segmented, Switch } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
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
const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Haute' },
  { value: 'critical', label: 'Critique' },
];
const SOURCES: TicketSource[] = ['operator', 'alarm', 'customer', 'plan'];

const field =
  'h-[38px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary';

/** Loose match between a short worklist site name and the active site name. */
const sameSite = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

export function Maintenance() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const { scope, sites, label } = useScope();
  const { toast } = useToast();
  const session = useSession();
  const canWrite = session.data?.permissions.includes('M4:ticket:write') ?? false;

  const query = useQuery({ queryKey: ['maintenance'], queryFn: () => api.getMaintenance() });
  const machinesQuery = useQuery({ queryKey: ['machines'], queryFn: () => api.getMachineStatuses() });

  const [showNew, setShowNew] = useState(false);
  const [showPlanConfig, setShowPlanConfig] = useState(false);
  const [customPlans, setCustomPlans] = useState<MaintenancePlanItem[] | null>(null);

  const activeSiteId = scope.type === 'site' ? scope.siteId : null;

  return (
    <>
      <ScreenHeader
        crumbs={[label, 'GMAO']}
        title={t('titles.maintenance')}
        actions={
          canWrite ? (
            <Button variant="primary" icon="plus" onClick={() => setShowNew(true)}>
              Nouveau ticket
            </Button>
          ) : undefined
        }
      />

      <QueryBoundary query={query}>
        {(d) => {
          const tickets = activeSiteId ? d.tickets.filter((tk) => tk.siteId === activeSiteId) : d.tickets;
          const worklist = activeSiteId
            ? d.worklist.filter((w) => sameSite(scope.type === 'site' ? scope.name : '', w.siteName))
            : d.worklist;
          const openStatuses = ['open', 'assigned', 'in_progress'];
          const openCount = tickets.filter((tk) => openStatuses.includes(tk.status)).length;
          const critCount = tickets.filter((tk) => tk.priority === 'critical' || tk.priority === 'high').length;
          const plans = customPlans ?? d.plans;

          return (
            <>
              <div className="mb-[18px] flex flex-wrap gap-3.5">
                <KpiCard
                  label="Tickets ouverts"
                  value={openCount}
                  foot={
                    <span className="inline-flex rounded-[7px] bg-danger-soft px-2 py-[3px] text-[11px] font-semibold text-danger">
                      {critCount} prioritaires
                    </span>
                  }
                />
                <KpiCard label="MTTR moyen" value={<>{num(d.mttrHours)} <span className="text-sm font-semibold text-fg-subtle">h</span></>} foot={<span className="text-[11.5px] font-semibold text-ok">−18 % vs mois préc.</span>} />
                <KpiCard label="MTBF moyen" value={<>{d.mtbfDays} <span className="text-sm font-semibold text-fg-subtle">j</span></>} foot={<span className="text-[11.5px] text-fg-subtle">Entre défaillances</span>} />
                <KpiCard label="Disponibilité parc" value={`${num(d.availabilityPct)} %`} valueClass="text-ok" foot={<span className="text-[11.5px] text-fg-subtle">{d.machinesTracked} machines suivies</span>} />
              </div>

              <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.65fr_1fr]">
                <SectionCard
                  title="File de tickets · priorisée"
                  subtitle={activeSiteId ? label : `${sites.length} sites`}
                >
                  {tickets.length === 0 ? (
                    <div className="px-[18px] py-8 text-center text-[13px] text-fg-subtle">
                      Aucun ticket pour ce site.
                    </div>
                  ) : (
                    tickets.map((tk) => {
                      const prio = PRIO[tk.priority];
                      const st = STATUS[tk.status];
                      return (
                        <div
                          key={tk.id}
                          onClick={() => toast(`${tk.code} · ${tk.title} — ${tk.siteName}. Ouverture du ticket.`, 'info')}
                          className="flex cursor-pointer items-center gap-[13px] border-b border-border px-[18px] py-[13px] last:border-b-0 hover:bg-surface-2"
                        >
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
                    })
                  )}
                </SectionCard>

                <div className="flex flex-col gap-[18px]">
                  <SectionCard title="Tournée du jour">
                    {worklist.length === 0 ? (
                      <div className="px-[17px] py-6 text-center text-[12.5px] text-fg-subtle">Aucune intervention planifiée.</div>
                    ) : (
                      worklist.map((w, i) => {
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
                      })
                    )}
                  </SectionCard>

                  <SectionCard
                    title="Plan préventif"
                    action={
                      canWrite ? (
                        <Button variant="secondary" size="sm" icon="gear" onClick={() => setShowPlanConfig(true)}>
                          Configurer
                        </Button>
                      ) : undefined
                    }
                    bodyClassName="p-4 pt-2.5"
                  >
                    {plans.length === 0 ? (
                      <div className="py-3 text-center text-[12.5px] text-fg-subtle">Aucun plan préventif défini.</div>
                    ) : (
                      plans.map((p, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-border py-2 text-[12.5px] last:border-b-0">
                          <span className="text-fg-muted">{p.label}</span>
                          <span className={cn('font-semibold', PLAN_URGENCY[p.urgency])}>{p.dueLabel}</span>
                        </div>
                      ))
                    )}
                  </SectionCard>
                </div>
              </div>

              <NewTicketModal
                open={showNew}
                onClose={() => setShowNew(false)}
                sites={sites}
                defaultSiteId={activeSiteId ?? sites[0]?.id}
                machines={machinesQuery.data?.items ?? []}
                onCreated={(tk, forwardedTo) => {
                  qc.invalidateQueries({ queryKey: ['maintenance'] });
                  toast(
                    forwardedTo
                      ? `Ticket ${tk.code} créé et transmis à ${forwardedTo}.`
                      : `Ticket ${tk.code} créé et ajouté à la file priorisée.`,
                  );
                }}
              />

              <PlanConfigModal
                open={showPlanConfig}
                onClose={() => setShowPlanConfig(false)}
                plans={plans}
                onSave={(next) => {
                  setCustomPlans(next);
                  toast('Plan préventif mis à jour.');
                }}
              />
            </>
          );
        }}
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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

/** M4 — create a maintenance ticket, optionally forwarded to an external tool. */
function NewTicketModal({
  open,
  onClose,
  sites,
  defaultSiteId,
  machines,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  sites: Site[];
  defaultSiteId?: string;
  machines: MachineStatus[];
  onCreated: (ticket: { code: string }, forwardedTo: string | null) => void;
}) {
  const api = useApi();
  const [params] = useAppParams();
  const fwd = params.ticketForwarding;
  const [siteId, setSiteId] = useState(defaultSiteId ?? sites[0]?.id ?? '');
  const [machineId, setMachineId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [source, setSource] = useState<TicketSource>('operator');
  const [description, setDescription] = useState('');
  const [forward, setForward] = useState(false);

  const siteMachines = useMemo(() => machines.filter((m) => m.siteId === siteId), [machines, siteId]);
  const create = useMutation({
    mutationFn: () =>
      api.createMaintenanceTicket({
        title: title.trim(),
        siteId,
        machineId: machineId || undefined,
        priority,
        source,
        description: description.trim() || undefined,
      }),
  });

  const reset = () => {
    setMachineId('');
    setTitle('');
    setPriority('medium');
    setSource('operator');
    setDescription('');
    setForward(false);
    create.reset();
  };

  // On open, (re)sync the site from the current default (sites may have loaded
  // after first mount) and clear the rest of the form.
  useEffect(() => {
    if (open) {
      setSiteId(defaultSiteId ?? sites[0]?.id ?? '');
      reset();
    }
  }, [open]);

  const valid = title.trim().length >= 3 && !!siteId;
  const submit = () => {
    if (!valid) return;
    create.mutate(undefined, {
      onSuccess: (tk) => {
        onCreated(tk, forward && fwd.enabled ? fwd.software || 'le logiciel configuré' : null);
        reset();
        onClose();
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="wrench"
      title="Nouveau ticket de maintenance"
      subtitle="Créez un ticket et affectez-le à un site / une machine."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? 'Création…' : 'Créer le ticket'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Labeled label="Site">
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setMachineId(''); }} className={field}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Machine (optionnel)">
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className={field}>
              <option value="">— Aucune —</option>
              {siteMachines.map((m) => (
                <option key={m.machineId} value={m.machineId}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
          </Labeled>
        </div>

        <Labeled label="Titre">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Monnayeur bloqué"
            className={field}
            maxLength={120}
          />
        </Labeled>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Labeled label="Priorité">
            <Segmented value={priority} onChange={setPriority} options={PRIORITIES} size="sm" />
          </Labeled>
          <Labeled label="Origine">
            <select value={source} onChange={(e) => setSource(e.target.value as TicketSource)} className={field}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE[s]}
                </option>
              ))}
            </select>
          </Labeled>
        </div>

        <Labeled label="Description (optionnel)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Décrivez le problème, la cause probable…"
            className={cn(field, 'h-auto resize-none py-2')}
            maxLength={2000}
          />
        </Labeled>

        {fwd.enabled ? (
          <Switch
            checked={forward}
            onChange={setForward}
            label={`Transmettre au logiciel « ${fwd.software || 'externe'} »`}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-[9px] bg-surface-2 px-3 py-2.5 text-[11.5px] text-fg-subtle">
            <Icon name="info" size={14} className="text-info" />
            Configurez un logiciel de maintenance dans Paramètres pour transmettre les tickets automatiquement.
          </div>
        )}

        {create.isError && (
          <div className="text-[12px] font-semibold text-danger">Échec de la création — réessayez.</div>
        )}
      </div>
    </Modal>
  );
}

/** M4 — admin configuration of preventive-maintenance plans. */
function PlanConfigModal({
  open,
  onClose,
  plans,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  plans: MaintenancePlanItem[];
  onSave: (plans: MaintenancePlanItem[]) => void;
}) {
  const [draft, setDraft] = useState<MaintenancePlanItem[]>(plans);

  // Reset the draft each time the modal is opened.
  useEffect(() => {
    if (open) setDraft(plans.map((p) => ({ ...p })));
  }, [open]);

  const update = (i: number, patch: Partial<MaintenancePlanItem>) =>
    setDraft((d) => d.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => setDraft((d) => d.filter((_, j) => j !== i));
  const add = () => setDraft((d) => [...d, { label: '', dueLabel: 'À jour', urgency: 'ok' }]);

  const valid = draft.every((p) => p.label.trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="gear"
      title="Configurer le plan préventif"
      subtitle="Définissez les échéances de maintenance préventive par machine ou par parc."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!valid}
            onClick={() => {
              onSave(draft.filter((p) => p.label.trim()));
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {draft.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-surface-2 p-2.5">
            <input
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Ex. SL-01 · 5000 cycles"
              className={cn(field, 'min-w-[180px] flex-[2_1_180px]')}
            />
            <input
              value={p.dueLabel}
              onChange={(e) => update(i, { dueLabel: e.target.value })}
              placeholder="Dans 18 j"
              className={cn(field, 'w-[120px] flex-[1_1_100px]')}
            />
            <Segmented
              value={p.urgency}
              onChange={(v) => update(i, { urgency: v })}
              size="sm"
              options={[
                { value: 'ok', label: 'À jour' },
                { value: 'soon', label: 'Bientôt' },
                { value: 'overdue', label: 'En retard' },
              ]}
            />
            <button
              onClick={() => remove(i)}
              aria-label="Supprimer"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-fg-subtle hover:border-danger hover:text-danger"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
        <Button variant="subtle" icon="plus" onClick={add} className="self-start">
          Ajouter un plan
        </Button>
      </div>
    </Modal>
  );
}
