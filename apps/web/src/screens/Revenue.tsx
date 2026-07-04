import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod, ReconciliationStatus, RevenueSummary } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, money2, num, relativeTime } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const RECON_META: Record<ReconciliationStatus, { label: string; bg: string; fg: string; row: string }> = {
  reconciled: { label: 'Rapproché', bg: 'bg-ok-soft', fg: 'text-ok', row: '' },
  tolerated: { label: 'Toléré', bg: 'bg-surface-3', fg: 'text-fg-muted', row: '' },
  to_review: { label: 'À vérifier', bg: 'bg-warn-soft', fg: 'text-warn', row: 'bg-warn-soft' },
  critical: { label: 'Écart critique', bg: 'bg-danger-soft', fg: 'text-danger', row: 'bg-danger-soft' },
};

const METHOD_LABEL: Record<PaymentMethod, { label: string; color: string }> = {
  contactless: { label: 'Sans contact', color: 'var(--info)' },
  cash: { label: 'Espèces', color: 'var(--warn)' },
  card: { label: 'Carte bancaire', color: 'var(--primary)' },
  wallet: { label: 'Wallet app', color: 'var(--energy)' },
};

export function Revenue() {
  const { t } = useTranslation();
  const api = useApi();
  const { label } = useScope();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['revenue', '7d'], queryFn: () => api.getRevenue('7d') });

  const exportRecon = (d: RevenueSummary) => {
    downloadCsv(
      'reconciliation-7j.csv',
      ['Site', 'Théorique (€)', 'Encaissé (€)', 'Écart (€)', 'Statut'],
      d.reconciliation.map((r) => [
        r.siteName,
        (r.theoretical.amountCents / 100).toFixed(2),
        (r.collected.amountCents / 100).toFixed(2),
        (r.variance.amountCents / 100).toFixed(2),
        RECON_META[r.status].label,
      ]),
    );
    toast('Réconciliation exportée (CSV).');
  };

  return (
    <>
      <ScreenHeader
        crumbs={[label, '7 derniers jours']}
        title={t('titles.revenue')}
        actions={
          <Button variant="secondary" icon="download" onClick={() => query.data && exportRecon(query.data)}>
            {t('common.export')}
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Card className="flex-[1.4_1_230px] p-4">
                <div className="text-[12.5px] font-semibold text-fg-muted">CA encaissé · 7 j</div>
                <div className="mt-1.5 whitespace-nowrap text-[28px] font-bold tabular-nums tracking-[-0.8px]">
                  {money0(d.collected)}
                </div>
                <div className="mt-1 text-[11.5px] text-fg-subtle">
                  Panier moyen {money2(d.averageBasket)} · {num(d.cycles)} cycles
                </div>
              </Card>
              <Card className="flex-[1_1_200px] p-4">
                <div className="text-[12.5px] font-semibold text-fg-muted">Écart de réconciliation</div>
                <div className="mt-1.5 whitespace-nowrap text-[28px] font-bold tabular-nums tracking-[-0.8px] text-danger">
                  {money0(d.reconciliationVariance)}
                </div>
                <div className="mt-1 text-[11.5px] text-fg-subtle">{d.sitesToVerify} sites à vérifier · 1 critique</div>
              </Card>
              <Card className="flex-[1_1_200px] p-4">
                <div className="text-[12.5px] font-semibold text-fg-muted">Espèces à collecter</div>
                <div className="mt-1.5 whitespace-nowrap text-[28px] font-bold tabular-nums tracking-[-0.8px] text-warn">
                  {money0(d.cashToCollect)}
                </div>
                <div className="mt-1.5 inline-flex rounded-[7px] bg-warn-soft px-2 py-[3px] text-[11px] font-semibold text-warn">
                  {d.cashCollectorCount} monnayeurs · collecte à planifier
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
              <SectionCard
                title="Réconciliation des recettes"
                subtitle="Théorique (cycles) vs encaissé (collecte) vs lecture terminal"
              >
                <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr_.9fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                  <div>Site</div>
                  <div className="text-right">Théorique</div>
                  <div className="text-right">Encaissé</div>
                  <div className="text-right">Écart</div>
                  <div className="text-right">Statut</div>
                </div>
                {d.reconciliation.map((r) => {
                  const meta = RECON_META[r.status];
                  return (
                    <div
                      key={r.siteId}
                      onClick={() => toast(`${r.siteName} · écart ${money0(r.variance)} — ouverture du détail des événements.`, 'info')}
                      className={cn(
                        'grid cursor-pointer grid-cols-[1.7fr_1fr_1fr_1fr_.9fr] items-center gap-2 border-b border-border px-[18px] py-[13px] hover:bg-surface-2',
                        meta.row,
                      )}
                    >
                      <div className="truncate text-[13px] font-semibold">{r.siteName}</div>
                      <div className="text-right text-[12.5px] tabular-nums text-fg-muted">{money0(r.theoretical)}</div>
                      <div className="text-right text-[12.5px] font-semibold tabular-nums">{money0(r.collected)}</div>
                      <div className={cn('text-right text-[12.5px] font-bold tabular-nums', meta.fg)}>
                        {money0(r.variance)}
                      </div>
                      <div className="text-right">
                        <span className={cn('inline-block whitespace-nowrap rounded-[7px] px-[9px] py-[3px] text-[11px] font-bold', meta.bg, meta.fg)}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 px-[18px] py-[11px] text-xs text-fg-subtle">
                  <Icon name="info" size={14} strokeWidth={1.8} />
                  Cliquez une ligne pour explorer les événements à l'origine de l'écart.
                </div>
              </SectionCard>

              <div className="flex flex-col gap-[18px]">
                <Card className="p-4">
                  <div className="mb-3.5 text-sm font-bold">Moyens de paiement</div>
                  <div className="flex flex-col gap-[13px]">
                    {d.methods.map((mt) => {
                      const meta = METHOD_LABEL[mt.method];
                      return (
                        <div key={mt.method}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                              <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: meta.color }} />
                              {meta.label}
                            </span>
                            <span className="text-[12.5px] font-bold tabular-nums">{money0(mt.amount)}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-[7px] flex-1 overflow-hidden rounded-[4px] bg-surface-3">
                              <div className="h-full rounded-[4px]" style={{ width: `${mt.pct}%`, background: meta.color }} />
                            </div>
                            <span className="w-[30px] text-right text-[11px] tabular-nums text-fg-subtle">{mt.pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <SectionCard title="Remboursements récents" action={<span className="text-[11px] text-fg-subtle">7 j</span>}>
                  {d.recentRefunds.map((r) => (
                    <div key={r.id} className="flex items-center gap-[11px] border-b border-border px-[17px] py-[11px] last:border-b-0">
                      <div className="flex-1">
                        <div className="text-[12.5px] font-semibold">
                          {r.reason}
                          {r.machineCode ? ` · ${r.machineCode}` : ''}
                        </div>
                        <div className="text-[11px] text-fg-subtle">
                          {r.siteName} · {relativeTime(r.at)}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums">{money2(r.amount)}</span>
                    </div>
                  ))}
                </SectionCard>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
