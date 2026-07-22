import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod, ReconciliationStatus } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, num } from '@/lib/format';
import { Card, ScreenHeader, StatCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  contactless: 'Sans contact',
  cash: 'Espèces',
  card: 'Carte',
  wallet: 'Wallet',
};
const METHOD_COLOR: Record<PaymentMethod, string> = {
  contactless: 'bg-primary',
  cash: 'bg-warn',
  card: 'bg-info',
  wallet: 'bg-energy',
};

const RECON_META: Record<ReconciliationStatus, { label: string; cls: string }> = {
  reconciled: { label: 'Réconcilié', cls: 'bg-ok-soft text-ok' },
  tolerated: { label: 'Toléré', cls: 'bg-info-soft text-info' },
  to_review: { label: 'À vérifier', cls: 'bg-warn-soft text-warn' },
  critical: { label: 'Critique', cls: 'bg-danger-soft text-danger' },
};

/** Recettes & monétique — descriptive read-only view (revenue, methods, reconciliation). */
export function Revenue() {
  const { t } = useTranslation();
  const api = useApi();
  const { isAll, label } = useScope();
  const query = useQuery({
    queryKey: ['revenue', 'today'],
    queryFn: () => api.getRevenue('today'),
  });

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.revenue')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard
                label="Recettes encaissées"
                icon="euro"
                iconClass="text-primary"
                value={money0(d.collected)}
              />
              <StatCard
                label="Panier moyen"
                icon="euro"
                iconClass="text-info"
                value={money0(d.averageBasket)}
              />
              <StatCard
                label="Cycles"
                icon="washer"
                iconClass="text-fg-muted"
                value={num(d.cycles)}
              />
              <StatCard
                label="Espèces à collecter"
                icon="euro"
                iconClass="text-warn"
                value={money0(d.cashToCollect)}
                footer={`${d.cashCollectorCount} collecteurs`}
              />
            </div>

            {/* Payment methods */}
            <Card className="mb-[18px] p-[18px_20px]">
              <div className="mb-3 text-[15px] font-bold">Répartition par moyen de paiement</div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
                {d.methods.map((m) => (
                  <div
                    key={m.method}
                    className={METHOD_COLOR[m.method]}
                    style={{ width: `${m.pct}%` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {d.methods.map((m) => (
                  <div key={m.method} className="flex items-center gap-1.5 text-[12px]">
                    <span className={cn('h-2 w-2 rounded-full', METHOD_COLOR[m.method])} />
                    <span className="text-fg-muted">{METHOD_LABEL[m.method]}</span>
                    <span className="font-bold tabular-nums">{money0(m.amount)}</span>
                    <span className="text-fg-subtle">· {m.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Reconciliation */}
            <Card className="overflow-hidden">
              <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                Réconciliation des recettes
              </div>
              <div className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr_.9fr] gap-2 border-b border-border px-[18px] py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                <div>Site</div>
                <div className="text-right">Théorique</div>
                <div className="text-right">Encaissé</div>
                <div className="text-right">Écart</div>
                <div className="text-right">Statut</div>
              </div>
              {d.reconciliation.map((r) => (
                <div
                  key={r.siteId}
                  className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr_.9fr] items-center gap-2 border-b border-border px-[18px] py-2.5 last:border-b-0"
                >
                  <div className="truncate text-[12.5px] font-semibold">{r.siteName}</div>
                  <div className="text-right text-[12.5px] tabular-nums text-fg-muted">
                    {money0(r.theoretical)}
                  </div>
                  <div className="text-right text-[12.5px] font-semibold tabular-nums">
                    {money0(r.collected)}
                  </div>
                  <div
                    className={cn(
                      'text-right text-[12.5px] font-semibold tabular-nums',
                      r.variance.amountCents < 0 ? 'text-danger' : 'text-fg-muted',
                    )}
                  >
                    {money0(r.variance)}
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'inline-flex rounded-[7px] px-2 py-0.5 text-[11px] font-bold',
                        RECON_META[r.status].cls,
                      )}
                    >
                      {RECON_META[r.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
