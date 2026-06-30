import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ConnectorStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { Card, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const TONE: Record<ConnectorStatus, { label: string; c: string; bg: string; btn: string; solid: boolean }> = {
  connected: { label: 'Connecté', c: 'text-ok', bg: 'bg-ok-soft', btn: 'Gérer', solid: false },
  connecting: { label: 'Connexion…', c: 'text-info', bg: 'bg-info-soft', btn: 'Connexion…', solid: false },
  error: { label: 'Erreur', c: 'text-danger', bg: 'bg-danger-soft', btn: 'Reconnecter', solid: true },
  not_connected: { label: 'Non connecté', c: 'text-fg-subtle', bg: 'bg-surface-3', btn: 'Connecter', solid: true },
};

export function Settings() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['admin'], queryFn: () => api.getAdmin() });
  const [overrides, setOverrides] = useState<Record<string, ConnectorStatus>>({});

  const connect = (id: string) => {
    setOverrides((o) => ({ ...o, [id]: 'connecting' }));
    setTimeout(() => setOverrides((o) => ({ ...o, [id]: 'connected' })), 1400);
  };

  return (
    <>
      <ScreenHeader crumbs={['Groupe Lavéo', 'Administration']} title={t('titles.settings')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <Card className="mb-[18px] p-[18px_20px]">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-base font-bold">Connectez vos outils</div>
                <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <span className="h-[7px] w-[7px] rounded-full bg-ok" />8 connectés · 1 en erreur
                </span>
              </div>
              <div className="mb-[18px] text-[12.5px] text-fg-subtle">
                Centrales de paiement, machines, IA, comptabilité, énergie et messagerie. Les secrets sont stockés dans AWS
                Secrets Manager — jamais en clair.
              </div>
              <div className="flex flex-col gap-5">
                {d.connectors.map((cat) => (
                  <div key={cat.group}>
                    <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-fg-subtle">{cat.group}</div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
                      {cat.items.map((it) => {
                        const status = overrides[it.id] ?? it.status;
                        const tone = TONE[status];
                        const active = status === 'not_connected' || status === 'error';
                        return (
                          <div key={it.id} className="rounded-[12px] border border-border bg-surface-2 p-3.5">
                            <div className="mb-3 flex items-center gap-[11px]">
                              <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-[12px] font-bold text-fg-muted">
                                {it.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-semibold">{it.name}</div>
                                <div className="truncate text-[11px] text-fg-subtle">{it.kindLabel}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-bold', tone.bg, tone.c)}>
                                <span className={cn('h-[7px] w-[7px] rounded-full bg-current', status === 'connecting' && 'animate-pl-pulse')} />
                                {tone.label}
                              </span>
                              <button
                                onClick={() => active && connect(it.id)}
                                className={cn(
                                  'h-[30px] rounded-[8px] px-[13px] text-[12px] font-semibold',
                                  tone.solid ? 'bg-primary text-primary-fg' : 'border border-border text-fg',
                                  tone.c && !tone.solid && tone.c,
                                )}
                              >
                                {tone.btn}
                              </button>
                            </div>
                            <div className="mt-2 truncate text-[10.5px] text-fg-subtle">
                              {status === 'connecting' ? 'Établissement de la connexion…' : it.note}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
              <SectionCard
                title="Rôles & permissions"
                subtitle="Matrice RBAC · cloisonnement par périmètre (réseau / site / machine)"
              >
                <div className="overflow-x-auto">
                  <div className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] gap-1 border-b border-border px-[18px] py-2.5">
                    <div />
                    {d.rbac.roles.map((r) => (
                      <div key={r.key} className="text-center text-[10.5px] font-bold leading-[1.2] text-fg-muted">
                        {r.label}
                      </div>
                    ))}
                  </div>
                  {d.rbac.rows.map((row) => (
                    <div key={row.permissionKey} className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] items-center gap-1 border-b border-border px-[18px] py-[9px] last:border-b-0">
                      <div className="truncate text-xs font-medium">{row.label}</div>
                      {row.allowed.map((ok, i) => (
                        <div key={i} className="flex items-center justify-center">
                          {ok ? (
                            <Icon name="check" size={16} className="text-ok" strokeWidth={2.4} />
                          ) : (
                            <span className="h-[2px] w-3 rounded bg-border-strong" />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Journal d'audit">
                {d.audit.map((ev) => (
                  <div key={ev.id} className="flex gap-[11px] border-b border-border px-[18px] py-3 last:border-b-0">
                    <span className="w-[38px] flex-shrink-0 font-mono text-[11px] text-fg-subtle">
                      {new Date(ev.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1 text-[12.5px] leading-[1.4]">
                      <span className="font-semibold">{ev.userLabel}</span> <span className="text-fg-muted">{ev.action}</span>
                      <div className="mt-px text-[11px] text-fg-subtle">{ev.entityLabel}</div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
