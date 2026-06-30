import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MachineState, MachineStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { money0, money2, relativeTime } from '@/lib/format';
import { Card, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const query = useQuery({ queryKey: ['machines'], queryFn: () => api.getMachineStatuses() });

  return (
    <>
      <ScreenHeader
        crumbs={[t('topbar.allSites'), 'Lyon-3 Guillotière']}
        title={t('titles.machines')}
        actions={
          <div className="flex items-center gap-1.5 rounded-[8px] bg-ok-soft px-[11px] py-1.5 text-xs text-fg-subtle">
            <span className="h-[7px] w-[7px] animate-pl-pulse rounded-full bg-ok" />
            <span className="font-semibold text-fg-muted">Flux temps réel · SSE · il y a 8 s</span>
          </div>
        }
      />

      <QueryBoundary query={query}>
        {(data) => {
          const items = kind === 'all' ? data.items : data.items.filter((m) => m.kind === kind);
          return (
            <>
              <div className="mb-5 flex flex-wrap gap-3">
                {COUNTERS.map((c) => (
                  <Card key={c.key} className="flex-[1_1_130px] p-[13px_15px]">
                    <div className={cn('flex items-center gap-1.5 text-xs font-semibold', c.text)}>
                      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                      {c.label}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{data.counts[c.key]}</div>
                  </Card>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {([
                  ['all', `Toutes · ${data.items.length}`],
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

export { money2, relativeTime };
