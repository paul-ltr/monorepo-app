import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  MachineDistPeriod,
  MachineKind,
  MachineState,
  MachineStatus,
  Site,
} from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, money2, relativeTime } from '@/lib/format';
import { Button, Card, InfoButton, ScreenHeader, SectionCard, Segmented } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { StackedBars } from '@/components/charts';
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

const COUNTERS: { key: MachineState; label: string; text: string; dot: string; color: string }[] = [
  { key: 'free', label: 'Libres', text: 'text-ok', dot: 'bg-ok', color: 'var(--ok)' },
  { key: 'running', label: 'En cours', text: 'text-info', dot: 'bg-info', color: 'var(--info)' },
  { key: 'finished', label: 'Terminés', text: 'text-warn', dot: 'bg-warn', color: 'var(--warn)' },
  { key: 'out_of_service', label: 'Hors service', text: 'text-danger', dot: 'bg-danger', color: 'var(--danger)' },
  { key: 'offline', label: 'Hors ligne', text: 'text-fg-subtle', dot: 'bg-fg-subtle', color: 'var(--fg-subtle)' },
];

const DIST_PERIODS: { value: MachineDistPeriod; label: string }[] = [
  { value: '7d', label: '7 j' },
  { value: '30d', label: '30 j' },
  { value: '90d', label: '90 j' },
];

type KindFilter = 'all' | 'washer' | 'dryer';
type StateFilter = 'all' | MachineState;

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

export function Machines() {
  const { t } = useTranslation();
  const api = useApi();
  const { scope, sites, label } = useScope();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [showConnect, setShowConnect] = useState(false);
  const [added, setAdded] = useState<MachineStatus[]>([]);
  const [distPeriod, setDistPeriod] = useState<MachineDistPeriod>('30d');
  // Per-site filter for this screen. Defaults to the global scope, but can be
  // changed here independently (e.g. compare a single site while scope = all).
  const [siteFilter, setSiteFilter] = useState<string>(scope.type === 'site' ? scope.siteId : 'all');

  // Follow the topbar scope selector when it changes.
  useEffect(() => {
    setSiteFilter(scope.type === 'site' ? scope.siteId : 'all');
  }, [scope]);

  const query = useQuery({ queryKey: ['machines'], queryFn: () => api.getMachineStatuses() });
  const distQuery = useQuery({
    queryKey: ['machine-dist', distPeriod, siteFilter],
    queryFn: () => api.getMachineStateDistribution(distPeriod, siteFilter === 'all' ? undefined : siteFilter),
  });

  const onConnect = (m: MachineStatus) => {
    setAdded((a) => [m, ...a]);
    setShowConnect(false);
    toast(`Machine « ${m.code} » connectée sur ${m.siteName} · en attente de première synchronisation.`);
  };

  const dist = distQuery.data;

  return (
    <>
      <ScreenHeader
        crumbs={[label, scope.type === 'all' ? `Parc consolidé · ${sites.length} sites` : 'Parc du site']}
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

      {showConnect && (
        <ConnectMachineForm
          sites={sites}
          defaultSiteId={siteFilter === 'all' ? sites[0]?.id : siteFilter}
          onConnect={onConnect}
          onCancel={() => setShowConnect(false)}
        />
      )}

      <QueryBoundary query={query}>
        {(data) => {
          const allItems = [...added, ...data.items];
          const bySite = siteFilter === 'all' ? allItems : allItems.filter((m) => m.siteId === siteFilter);
          const counts: Record<MachineState, number> = {
            free: 0,
            running: 0,
            finished: 0,
            out_of_service: 0,
            offline: 0,
          };
          for (const m of bySite) counts[m.state] += 1;
          const byKind = kind === 'all' ? bySite : bySite.filter((m) => m.kind === kind);
          const items = stateFilter === 'all' ? byKind : byKind.filter((m) => m.state === stateFilter);
          return (
            <>
              <div className="mb-5 flex flex-wrap gap-3">
                {COUNTERS.map((c) => {
                  const active = stateFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setStateFilter((f) => (f === c.key ? 'all' : c.key))}
                      aria-pressed={active}
                      className={cn(
                        'flex-[1_1_130px] rounded-[14px] border bg-surface p-[13px_15px] text-left shadow-card transition-colors',
                        active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong',
                      )}
                    >
                      <div className={cn('flex items-center gap-1.5 text-xs font-semibold', c.text)}>
                        <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                        {c.label}
                      </div>
                      <div className="mt-1 text-2xl font-bold tabular-nums">{counts[c.key]}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <Segmented
                  ariaLabel="Type de machine"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'all', label: `Toutes · ${bySite.length}` },
                    { value: 'washer', label: 'Lave-linge', icon: 'washer' },
                    { value: 'dryer', label: 'Sèche-linge', icon: 'dryer' },
                  ]}
                />
                <label className="flex items-center gap-2 text-[12.5px]">
                  <Icon name="mapPin" size={14} className="text-fg-muted" />
                  <select
                    aria-label="Filtrer par site"
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                    className="h-[34px] rounded-[9px] border border-border bg-surface px-2.5 text-[12.5px] font-semibold outline-none focus:border-primary"
                  >
                    <option value="all">Tous les sites</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {stateFilter !== 'all' && (
                  <button
                    onClick={() => setStateFilter('all')}
                    className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border bg-surface px-[13px] text-[12.5px] font-semibold text-fg-muted hover:border-border-strong"
                  >
                    <Icon name="close" size={13} />
                    État : {STATE_META[stateFilter].label}
                  </button>
                )}
                <div className="flex-1" />
                <span className="text-[12px] font-semibold text-fg-subtle">{items.length} machines</span>
              </div>

              {items.length === 0 ? (
                <Card className="p-8 text-center text-[13px] text-fg-subtle">
                  Aucune machine pour ce filtre.
                </Card>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(206px,1fr))] gap-3.5">
                  {items.map((m) => (
                    <MachineCard
                      key={m.machineId}
                      m={m}
                      showSite={siteFilter === 'all'}
                      onClick={() => setOpenId(m.machineId)}
                    />
                  ))}
                </div>
              )}

              <SectionCard
                className="mt-6"
                title={
                  <span className="flex items-center gap-1.5">
                    Répartition des états
                    <InfoButton label="Part du parc dans chaque état, jour par jour, sur la période choisie. La dernière barre correspond à l’instantané actuel. Données de supervision agrégées." />
                  </span>
                }
                subtitle={siteFilter === 'all' ? 'Tous les sites' : sites.find((s) => s.id === siteFilter)?.name}
                action={
                  <Segmented ariaLabel="Période d’analyse" size="sm" value={distPeriod} onChange={setDistPeriod} options={DIST_PERIODS} />
                }
                bodyClassName="p-4"
              >
                {dist?.averageShares && Array.isArray(dist.points) ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                      {COUNTERS.map((c) => (
                        <div key={c.key} className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                          <span className={c.text}>{c.label}</span>
                          <span className="tabular-nums text-fg-subtle">{dist.averageShares[c.key] ?? 0} %</span>
                        </div>
                      ))}
                    </div>
                    <StackedBars
                      height={150}
                      bars={dist.points.map((p) => ({
                        label: `${fmtDay(p.date)} · ${p.free} libres · ${p.running} en cours · ${p.out_of_service + p.offline} indispo.`,
                        total: dist.fleetSize,
                        segments: COUNTERS.map((c) => ({ color: c.color, value: p[c.key] })),
                      }))}
                    />
                    <div className="mt-2 flex justify-between text-[10.5px] text-fg-subtle">
                      <span>{dist.points[0] && fmtDay(dist.points[0].date)}</span>
                      <span>{dist.points.length > 0 && fmtDay(dist.points[dist.points.length - 1]!.date)}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-[190px] animate-pulse rounded-[10px] bg-surface-3" />
                )}
              </SectionCard>
            </>
          );
        }}
      </QueryBoundary>

      {openId && <MachineDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function MachineCard({ m, showSite, onClick }: { m: MachineStatus; showSite: boolean; onClick: () => void }) {
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
          {showSite && (
            <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-fg-subtle">
              <Icon name="mapPin" size={11} />
              <span className="truncate">{m.siteName}</span>
            </div>
          )}
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

/** M1 — connect/parametrize a new machine on a chosen site (mock: appends live). */
function ConnectMachineForm({
  sites,
  defaultSiteId,
  onConnect,
  onCancel,
}: {
  sites: Site[];
  defaultSiteId?: string;
  onConnect: (m: MachineStatus) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<MachineKind>('washer');
  const [capacity, setCapacity] = useState('8');
  const [brand, setBrand] = useState('speed_queen');
  const [siteId, setSiteId] = useState<string>(defaultSiteId ?? sites[0]?.id ?? '');

  const brands = [
    ['speed_queen', 'Speed Queen'],
    ['girbau', 'Girbau'],
    ['miele', 'Miele'],
    ['electrolux', 'Electrolux'],
    ['other', 'Autre'],
  ] as const;

  const submit = () => {
    const c = code.trim().toUpperCase();
    const site = sites.find((s) => s.id === siteId);
    if (!c || !site) return;
    const name = `${kind === 'dryer' ? 'Sèche-linge' : 'Lave-linge'} ${capacity} kg`;
    onConnect({
      machineId: `local-${c}-${Date.now()}`,
      siteId: site.id,
      siteName: site.name,
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
        <MField label="Site">
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="h-[38px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </MField>
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
        <Button variant="primary" onClick={submit} disabled={!code.trim() || !siteId}>
          Connecter
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
      <div className="mt-2.5 text-[11.5px] text-fg-subtle">
        La machine est appairée à la centrale du site sélectionné puis synchronisée automatiquement sous quelques minutes.
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
