import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MachineKind, MachineState, MachineStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, money2, relativeTime } from '@/lib/format';
import { Button, Card, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';
import { MachineDrawer } from './MachineDrawer';

const STATE_META: Record<MachineState, { label: string; fg: string; bg: string; dot: string; text: string }> = {
  free: { label: 'Libre', fg: 'border-l-ok', bg: 'bg-ok-soft', dot: 'bg-ok', text: 'text-ok' },
  running: { label: 'En cours', fg: 'border-l-info', bg: 'bg-info-soft', dot: 'bg-info', text: 'text-info' },
  finished: { label: 'Terminé', fg: 'border-l-warn', bg: 'bg-warn-soft', dot: 'bg-warn', text: 'text-warn' },
  out_of_service: { label: 'Hors service', fg: 'border-l-danger', bg: 'bg-danger-soft', dot: 'bg-danger', text: 'text-danger' },
  offline: { label: 'Hors ligne', fg: 'border-l-fg-subtle', bg: 'bg-surface-3', dot: 'bg-fg-subtle', text: 'text-fg-subtle' },
};

const COUNTERS: { key: MachineState; label: string; text: string; dot: string }[] = [
  { key: 'free', label: 'Libres', text: 'text-ok', dot: 'bg-ok' },
  { key: 'running', label: 'En cours', text: 'text-info', dot: 'bg-info' },
  { key: 'finished', label: 'Terminés', text: 'text-warn', dot: 'bg-warn' },
  { key: 'out_of_service', label: 'Hors service', text: 'text-danger', dot: 'bg-danger' },
  { key: 'offline', label: 'Hors ligne', text: 'text-fg-subtle', dot: 'bg-fg-subtle' },
];

type KindFilter = 'all' | 'washer' | 'dryer';

export function Machines() {
  const { t } = useTranslation();
  const api = useApi();
  const { scope, label } = useScope();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [showConnect, setShowConnect] = useState(false);
  const [added, setAdded] = useState<MachineStatus[]>([]);
  const query = useQuery({ queryKey: ['machines'], queryFn: () => api.getMachineStatuses() });

  const onConnect = (m: MachineStatus) => {
    setAdded((a) => [m, ...a]);
    setShowConnect(false);
    toast(`Machine « ${m.code} » connectée · en attente de première synchronisation.`);
  };

  return (
    <>
      <ScreenHeader
        crumbs={[label, scope.type === 'all' ? 'Parc consolidé · 6 sites' : 'Parc du site']}
        title={t('titles.machines')}
        actions={
          <>
            <div className="flex items-center gap-1.5 rounded-[8px] bg-ok-soft px-[11px] py-1.5 text-xs text-fg-subtle">
              <span className="h-[7px] w-[7px] animate-pl-pulse rounded-full bg-ok" />
              <span className="font-semibold text-fg-muted">Flux temps réel · SSE · il y a 8 s</span>
            </div>
            <Button variant="primary" icon="plus" onClick={() => setShowConnect((s) => !s)}>
              Connecter une machine
            </Button>
          </>
        }
      />

      {showConnect && <ConnectMachineForm onConnect={onConnect} onCancel={() => setShowConnect(false)} />}

      <QueryBoundary query={query}>
        {(data) => {
          const allItems = [...added, ...data.items];
          const items = kind === 'all' ? allItems : allItems.filter((m) => m.kind === kind);
          const counts = {
            ...data.counts,
            offline: data.counts.offline + added.filter((m) => m.state === 'offline').length,
          };
          return (
            <>
              <div className="mb-5 flex flex-wrap gap-3">
                {COUNTERS.map((c) => (
                  <Card key={c.key} className="flex-[1_1_130px] p-[13px_15px]">
                    <div className={cn('flex items-center gap-1.5 text-xs font-semibold', c.text)}>
                      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                      {c.label}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{counts[c.key]}</div>
                  </Card>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {([
                  ['all', `Toutes · ${allItems.length}`],
                  ['washer', 'Lave-linge'],
                  ['dryer', 'Sèche-linge'],
                ] as [KindFilter, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'h-[34px] rounded-[9px] px-3.5 text-[12.5px] font-semibold',
                      kind === k
                        ? 'bg-primary text-primary-fg'
                        : 'border border-border bg-surface text-fg-muted hover:border-border-strong',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex-1" />
                <button className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border bg-surface px-[13px] text-[12.5px] font-semibold text-fg hover:border-border-strong">
                  <Icon name="filter" size={14} className="text-fg-muted" strokeWidth={1.9} />
                  Filtrer par état
                </button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(206px,1fr))] gap-3.5">
                {items.map((m) => (
                  <MachineCard key={m.machineId} m={m} onClick={() => setOpenId(m.machineId)} />
                ))}
              </div>
            </>
          );
        }}
      </QueryBoundary>

      {openId && <MachineDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function MachineCard({ m, onClick }: { m: MachineStatus; onClick: () => void }) {
  const meta = STATE_META[m.state];
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-l-[3px] bg-surface text-left',
        'rounded-[13px] border border-border p-[14px_15px] shadow-card transition-all hover:-translate-y-px hover:shadow-lg',
        meta.fg,
      )}
    >
      <div className="mb-3.5 flex items-start gap-[11px]">
        <div className={cn('flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px]', meta.bg, meta.text)}>
          <Icon name={m.kind === 'dryer' ? 'dryer' : 'washer'} size={16} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold">{m.name}</div>
          <div className="mt-px font-mono text-[11.5px] text-fg-subtle">
            {m.code} · {m.kind === 'dryer' ? 'Séchage' : 'Lavage'}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', meta.dot)} />
          <div className="min-w-0">
            <div className={cn('whitespace-nowrap text-[12.5px] font-bold', meta.text)}>{meta.label}</div>
            <div className="truncate text-[11px] text-fg-subtle">{m.detail}</div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[11px] text-fg-subtle">{m.cyclesToday} cyc.</div>
          <div className="text-[12.5px] font-bold tabular-nums">{money0(m.revenueToday)}</div>
        </div>
      </div>
    </button>
  );
}

/** M1 — connect/parametrize a new machine (mock: appends to the live grid). */
function ConnectMachineForm({
  onConnect,
  onCancel,
}: {
  onConnect: (m: MachineStatus) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<MachineKind>('washer');
  const [capacity, setCapacity] = useState('8');
  const [brand, setBrand] = useState('speed_queen');

  const brands = [
    ['speed_queen', 'Speed Queen'],
    ['girbau', 'Girbau'],
    ['miele', 'Miele'],
    ['electrolux', 'Electrolux'],
    ['other', 'Autre'],
  ] as const;

  const submit = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const name = `${kind === 'dryer' ? 'Sèche-linge' : 'Lave-linge'} ${capacity} kg`;
    onConnect({
      machineId: `local-${c}-${Date.now()}`,
      code: c,
      name,
      kind,
      state: 'offline',
      detail: 'Nouvelle machine · en attente de synchronisation',
      cyclesToday: 0,
      revenueToday: { amountCents: 0, currency: 'EUR' },
      etaSeconds: null,
      freshness: { asOf: new Date().toISOString(), stale: true },
    });
  };

  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Icon name="plus" size={16} className="text-primary" strokeWidth={2} />
        Connecter une machine
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <MField label="Identifiant (code)">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="LL-11"
            className="h-[38px] w-[120px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          />
        </MField>
        <MField label="Type">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MachineKind)}
            className="h-[38px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          >
            <option value="washer">Lave-linge</option>
            <option value="dryer">Sèche-linge</option>
          </select>
        </MField>
        <MField label="Capacité (kg)">
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="h-[38px] w-[90px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          />
        </MField>
        <MField label="Marque / centrale">
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-[38px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          >
            {brands.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </MField>
        <Button variant="primary" onClick={submit} disabled={!code.trim()}>
          Connecter
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
      <div className="mt-2.5 text-[11.5px] text-fg-subtle">
        La machine est appairée à la centrale sélectionnée puis synchronisée automatiquement sous quelques minutes.
      </div>
    </Card>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

export { money2, relativeTime };
