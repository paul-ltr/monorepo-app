import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { relativeTime } from '@/lib/format';
import { Button, Card, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const SEV: Record<string, { c: string; bg: string }> = {
  critical: { c: 'text-danger', bg: 'bg-danger-soft' },
  warning: { c: 'text-warn', bg: 'bg-warn-soft' },
  info: { c: 'text-info', bg: 'bg-info-soft' },
};
const FILTERS = ['all', 'unread', 'Maintenance', 'Énergie', 'Recettes'] as const;
const FILTER_LABEL: Record<string, string> = {
  all: 'Toutes',
  unread: 'Non lues',
  Maintenance: 'Maintenance',
  Énergie: 'Énergie',
  Recettes: 'Recettes',
};

export function Notifications() {
  const { t } = useTranslation();
  const api = useApi();
  const { label, scope } = useScope();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [readAll, setReadAll] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => api.getNotifications() });

  const markRead = (id: string) => setReadIds((s) => new Set(s).add(id));

  return (
    <>
      <QueryBoundary query={query}>
        {(d) => {
          const all = d.items.map((n) => ({ ...n, read: readAll || readIds.has(n.id) ? true : n.read }));
          // Scope to the selected shop when a single site is active (match by name,
          // as notifications carry siteName — same convention as the dashboard).
          const items = scope.type === 'site' ? all.filter((n) => n.siteName === scope.name) : all;
          const unread = items.filter((n) => !n.read).length;
          let shown = items;
          if (filter === 'unread') shown = items.filter((n) => !n.read);
          else if (filter !== 'all') shown = items.filter((n) => n.category === filter);

          return (
            <>
              <ScreenHeader
                crumbs={[label, `${unread} non lues`]}
                title={t('titles.notifications')}
                actions={
                  <Button variant="secondary" icon="check" onClick={() => setReadAll(true)}>
                    {t('common.markAllRead')}
                  </Button>
                }
              />

              <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'h-[34px] rounded-[9px] px-3.5 text-[12.5px] font-semibold',
                      filter === f ? 'bg-primary text-primary-fg' : 'border border-border bg-surface text-fg-muted',
                    )}
                  >
                    {FILTER_LABEL[f]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
                <Card className="overflow-hidden">
                  {shown.length === 0 ? (
                    <div className="p-8 text-center text-sm text-fg-subtle">{t('common.empty')}</div>
                  ) : (
                    shown.map((n) => <Row key={n.id} n={n} onClick={() => markRead(n.id)} />)
                  )}
                </Card>

                <Card className="p-4">
                  <div className="mb-1 text-sm font-bold">Préférences</div>
                  <div className="mb-4 text-xs text-fg-subtle">Canaux par niveau de sévérité.</div>
                  <Pref title="Critiques" sub="Push + e-mail + SMS" defaultOn />
                  <Pref title="Attention" sub="Push + e-mail" defaultOn />
                  <Pref title="Info" sub="Dans l'app uniquement" />
                  <Pref title="Résumé quotidien" sub="E-mail · 08:00" defaultOn last />
                  <div className="mt-3 flex items-start gap-2 rounded-[9px] bg-surface-2 p-2.5">
                    <Icon name="info" size={14} className="mt-px flex-shrink-0 text-fg-subtle" strokeWidth={1.9} />
                    <div className="text-[11px] leading-[1.5] text-fg-subtle">
                      Les SMS sont envoyés au numéro défini pour chaque site.{' '}
                      <Link to="/settings" className="font-semibold text-primary hover:underline">
                        Configurer les numéros
                      </Link>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}

function Row({ n, onClick }: { n: Notification; onClick?: () => void }) {
  const sev = SEV[n.severity]!;
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex cursor-pointer gap-[13px] border-b border-l-[3px] border-border px-[18px] py-3.5 last:border-b-0 hover:bg-surface-2',
        n.read ? 'border-l-transparent bg-surface-2' : 'bg-surface',
      )}
      style={!n.read ? { borderLeftColor: 'currentColor' } : undefined}
    >
      <div className={cn('flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px]', sev.bg, sev.c)}>
        <Icon name={n.icon} size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">{n.title}</span>
          {!n.read && <span className={cn('h-[7px] w-[7px] rounded-full bg-current', sev.c)} />}
        </div>
        <div className="mt-[3px] text-xs leading-[1.45] text-fg-muted">{n.body}</div>
        <div className="mt-[5px] text-[11px] text-fg-subtle">
          {n.category} · {n.siteName} · {relativeTime(n.at)}
        </div>
      </div>
    </div>
  );
}

function Pref({ title, sub, defaultOn, last }: { title: string; sub: string; defaultOn?: boolean; last?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className={cn('flex items-center justify-between py-[11px]', !last && 'border-b border-border')}>
      <div>
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="text-[11px] text-fg-subtle">{sub}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => setOn((v) => !v)}
        className={cn('relative h-[22px] w-[38px] flex-shrink-0 rounded-[11px] transition-colors', on ? 'bg-primary' : 'border border-border bg-surface-3')}
      >
        <span
          className={cn('absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all', on ? 'right-[2px] bg-white' : 'left-[2px] bg-fg-subtle')}
        />
      </button>
    </div>
  );
}
