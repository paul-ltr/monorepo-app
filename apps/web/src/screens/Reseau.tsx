import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { money0, pct } from '@/lib/format';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

function medal(rank: number): { bg: string; fg: string } {
  if (rank === 1) return { bg: '#E9B949', fg: '#fff' };
  if (rank === 2) return { bg: '#AEB4BE', fg: '#fff' };
  if (rank === 3) return { bg: '#C58B5B', fg: '#fff' };
  return { bg: 'var(--surface-3)', fg: 'var(--fg-subtle)' };
}
function idxTone(i: number) {
  return i >= 70 ? { bar: 'bg-ok', text: 'text-ok' } : i >= 45 ? { bar: 'bg-warn', text: 'text-warn' } : { bar: 'bg-danger', text: 'text-danger' };
}

export function Reseau() {
  const { t } = useTranslation();
  const api = useApi();
  const session = useSession();
  const orgName = session.data?.tenant.name ?? 'Groupe Lavéo';
  const query = useQuery({ queryKey: ['network'], queryFn: () => api.getNetwork() });

  return (
    <>
      <ScreenHeader
        crumbs={[orgName, 'Réseau · 6 sites']}
        title={t('titles.reseau')}
        actions={
          <Button variant="secondary" icon="file">
            Rapport réseau
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Kpi label="CA réseau · 30 j" value={money0(d.revenue30d)} />
              <Kpi label="Indice benchmark" value={<>{d.benchmarkIndex}<span className="text-sm font-semibold text-fg-subtle"> /100</span></>} />
              <Kpi label="Sites en alerte" value={d.sitesInAlert} valueClass="text-danger" />
              <Kpi label="Redevances dues" value={money0(d.royaltiesDue)} />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
              <SectionCard title="Classement des sites · indice benchmark">
                {d.ranking.map((rk) => {
                  const m = medal(rk.rank);
                  const tone = idxTone(rk.index);
                  return (
                    <div key={rk.siteId} className="flex items-center gap-[13px] border-b border-border px-[18px] py-[13px] last:border-b-0">
                      <span
                        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[8px] text-[12.5px] font-bold tabular-nums"
                        style={{ background: m.bg, color: m.fg }}
                      >
                        {rk.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{rk.name}</div>
                        <div className="text-[11px] tabular-nums text-fg-subtle">{money0(rk.revenue)} · 30 j</div>
                      </div>
                      <div className="flex w-[110px] items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-surface-3">
                          <div className={cn('h-full rounded-[3px]', tone.bar)} style={{ width: `${rk.index}%` }} />
                        </div>
                        <span className={cn('w-[22px] text-right text-[11.5px] font-bold tabular-nums', tone.text)}>{rk.index}</span>
                      </div>
                      <span
                        className={cn(
                          'w-[52px] text-right text-xs font-bold tabular-nums',
                          rk.deltaPct > 0 ? 'text-ok' : rk.deltaPct < -2 ? 'text-danger' : 'text-fg-muted',
                        )}
                      >
                        {pct(rk.deltaPct)}
                      </span>
                    </div>
                  );
                })}
              </SectionCard>

              <div className="flex flex-col gap-[18px]">
                {d.exception && (
                  <Card className="border-danger p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-danger">
                      <Icon name="alert" size={16} strokeWidth={1.9} />
                      Exception détectée
                    </div>
                    <div className="text-[12.5px] leading-[1.5] text-fg-muted">
                      <strong>{d.exception.siteName}</strong> {d.exception.message}
                    </div>
                  </Card>
                )}

                <Card className="p-4">
                  <div className="mb-2.5 text-sm font-bold">Redevances · oct.</div>
                  <div className="flex items-center justify-between border-b border-border py-[7px] text-[12.5px]">
                    <span className="text-fg-muted">{d.royaltyBasisLabel}</span>
                    <span className="font-bold tabular-nums">{money0(d.royaltiesDue)}</span>
                  </div>
                  <div className="flex items-center justify-between py-[7px] text-[12.5px]">
                    <span className="text-fg-muted">Statut facturation</span>
                    <span className="font-semibold text-warn">À émettre</span>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="mb-1.5 text-sm font-bold">Standardisation</div>
                  <div className="text-[12.5px] leading-[1.5] text-fg-muted">{d.standardizationLabel}</div>
                </Card>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}

function Kpi({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <Card className="flex-[1_1_160px] p-4">
      <div className="text-[12.5px] font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 whitespace-nowrap text-[25px] font-bold tabular-nums', valueClass)}>{value}</div>
    </Card>
  );
}
