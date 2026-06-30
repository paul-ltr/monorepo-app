import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MachineState } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { money2 } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { LoadingBlock } from '@/components/state';
import { cn } from '@/lib/cn';

const STATE_META: Record<MachineState, { label: string; bg: string; fg: string }> = {
  free: { label: 'Libre', bg: 'bg-ok-soft', fg: 'text-ok' },
  running: { label: 'En cours', bg: 'bg-info-soft', fg: 'text-info' },
  finished: { label: 'Terminé', bg: 'bg-warn-soft', fg: 'text-warn' },
  out_of_service: { label: 'Hors service', bg: 'bg-danger-soft', fg: 'text-danger' },
  offline: { label: 'Hors ligne', bg: 'bg-surface-3', fg: 'text-fg-subtle' },
};

export function MachineDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useApi();
  const query = useQuery({ queryKey: ['machine', id], queryFn: () => api.getMachineDetail(id) });

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const m = query.data;
  const meta = m ? STATE_META[m.status] : null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(10,16,28,.42)] backdrop-blur-[1px]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Détail machine"
        className="fixed bottom-0 right-0 top-0 z-[41] flex w-[432px] max-w-[92vw] animate-pl-slide flex-col border-l border-border bg-surface shadow-lg"
      >
        <div className="flex items-start gap-[13px] border-b border-border p-[18px_20px]">
          <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[11px] bg-surface-3 text-fg-muted">
            <Icon name={m?.kind === 'dryer' ? 'dryer' : 'washer'} size={20} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold">{m ? `${m.name} · ${m.code}` : '…'}</div>
            <div className="mt-0.5 text-xs text-fg-subtle">
              {m ? `Lyon-3 Guillotière · ${m.brand} · SN ${m.serial}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border bg-surface text-fg-muted hover:border-border-strong"
          >
            <Icon name="close" size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-[18px_20px]">
          {!m || !meta ? (
            <LoadingBlock rows={4} />
          ) : (
            <>
              <div className={cn('mb-[18px] flex items-center gap-2.5 rounded-[11px] p-[11px_13px]', meta.bg, meta.fg)}>
                <span className="h-[9px] w-[9px] rounded-full bg-current" />
                <span className="text-[13.5px] font-bold">{meta.label}</span>
                <span className="flex-1" />
                <span className="text-[12.5px] font-semibold opacity-85">{m.statusDetail}</span>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-2.5">
                <Stat label="Cycles / jour" value={m.cyclesToday} />
                <Stat label="Uptime 30j" value={`${m.uptime30dPct.toLocaleString('fr-FR')} %`} />
                <Stat label="Énergie/cycle" value={m.energyPerCycleKwh ? `${m.energyPerCycleKwh.toLocaleString('fr-FR')} kWh` : '—'} />
              </div>

              <SectionLabel>Historique des cycles</SectionLabel>
              <div className="mb-5 overflow-hidden rounded-[11px] border border-border">
                {m.history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2.5 border-b border-border p-[10px_13px] text-[12.5px] last:border-b-0">
                    <span className="w-[42px] tabular-nums text-fg-subtle">
                      {new Date(h.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex-1 font-semibold">{h.program}</span>
                    <span className="tabular-nums text-fg-muted">{h.durationMin} min</span>
                    <span className="font-bold tabular-nums">{money2(h.amount)}</span>
                  </div>
                ))}
              </div>

              {m.openTicketId && (
                <>
                  <SectionLabel>Tickets liés</SectionLabel>
                  <div className="mb-2 flex items-center gap-2.5 rounded-[11px] border border-warn bg-warn-soft p-[11px_13px]">
                    <Icon name="alert" size={16} className="text-warn" strokeWidth={1.9} />
                    <div className="flex-1 text-[12.5px] font-semibold text-warn">
                      Ticket {m.openTicketId} ouvert — {m.statusDetail} · priorité haute
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border bg-surface-2 p-[14px_20px]">
          <div className="mb-2.5 text-[11px] font-semibold text-fg-subtle">Actions à distance · selon vos droits</div>
          <div className="flex gap-2.5">
            <button className="h-10 flex-1 rounded-[9px] border border-border-strong bg-surface text-[13px] font-semibold text-fg hover:border-danger hover:text-danger">
              Mettre hors service
            </button>
            <button className="h-10 flex-1 rounded-[9px] bg-primary text-[13px] font-semibold text-primary-fg hover:bg-primary-strong">
              Lancer un cycle
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[11px] border border-border bg-surface-2 p-[12px_13px]">
      <div className="text-[11px] font-semibold text-fg-subtle">{label}</div>
      <div className="mt-[3px] text-[19px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.4px] text-fg-subtle">{children}</div>
  );
}
