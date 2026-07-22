import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { Card, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SitesAdmin } from './settings/SitesAdmin';
import { UsersAdmin } from './settings/UsersAdmin';
import { QueryBoundary } from '@/components/state';

/**
 * Paramètres — sites, users, roles & audit. Connector onboarding now lives on
 * its own Connexions page, so it's intentionally absent here.
 */
export function Settings() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['admin'], queryFn: () => api.getAdmin() });
  const session = useSession();
  const canManageUsers = session.data?.permissions.includes('M12:users:manage') ?? false;

  return (
    <>
      <ScreenHeader
        crumbs={['Groupe Lavomatique', 'Administration']}
        title={t('titles.settings')}
      />

      <Card className="mb-[18px] flex items-center gap-3 p-[14px_18px]">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          <Icon name="link" size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] text-fg-muted">
          Les connexions (Enedis, GRDF, Wi-Line, Pennylane…) se gèrent désormais sur leur propre
          page.
        </div>
        <a
          href="/connections"
          className="flex-shrink-0 rounded-[9px] border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-primary hover:border-primary"
        >
          Ouvrir les connexions →
        </a>
      </Card>

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <SitesAdmin />
            {canManageUsers && <UsersAdmin />}

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
              <SectionCard
                title="Rôles & permissions"
                subtitle="Matrice RBAC · cloisonnement par périmètre (réseau / site / machine)"
              >
                <div className="overflow-x-auto">
                  <div className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] gap-1 border-b border-border px-[18px] py-2.5">
                    <div />
                    {d.rbac.roles.map((r) => (
                      <div
                        key={r.key}
                        className="text-center text-[10.5px] font-bold leading-[1.2] text-fg-muted"
                      >
                        {r.label}
                      </div>
                    ))}
                  </div>
                  {d.rbac.rows.map((row) => (
                    <div
                      key={row.permissionKey}
                      className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] items-center gap-1 border-b border-border px-[18px] py-[9px] last:border-b-0"
                    >
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
                  <div
                    key={ev.id}
                    className="flex gap-[11px] border-b border-border px-[18px] py-3 last:border-b-0"
                  >
                    <span className="w-[38px] flex-shrink-0 font-mono text-[11px] text-fg-subtle">
                      {new Date(ev.at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="min-w-0 flex-1 text-[12.5px] leading-[1.4]">
                      <span className="font-semibold">{ev.userLabel}</span>{' '}
                      <span className="text-fg-muted">{ev.action}</span>
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
