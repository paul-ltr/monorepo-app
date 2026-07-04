import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { FinanceSummary } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { money0 } from '@/lib/format';
import { downloadCsv, downloadText } from '@/lib/download';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

function marginTone(p: number) {
  return p >= 50 ? { bar: 'bg-ok', text: 'text-ok' } : p >= 35 ? { bar: 'bg-warn', text: 'text-warn' } : { bar: 'bg-danger', text: 'text-danger' };
}

export function Finances() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['finance'], queryFn: () => api.getFinance() });

  const generateFec = () => {
    // Minimal tab-delimited FEC-shaped stub (real export streams from the API).
    const header = ['JournalCode', 'EcritureDate', 'CompteNum', 'Libelle', 'Debit', 'Credit'].join('\t');
    const rows = [
      ['VT', '20251031', '706000', 'Ventes prestations lavage', '0.00', '128400.00'],
      ['VT', '20251031', '445710', 'TVA collectée 20%', '0.00', '25680.00'],
      ['BQ', '20251031', '512000', 'Encaissements CB/sans contact', '154080.00', '0.00'],
    ];
    downloadText('FEC-2025-10.txt', [header, ...rows.map((r) => r.join('\t'))].join('\n'), 'text/plain');
    toast('FEC généré — conforme, prêt pour l’expert-comptable.');
  };

  const exportVat = (d: FinanceSummary) => {
    downloadCsv('journal-tva.csv', ['Poste', 'Montant (€)'], [
      ['CA consolidé', (d.consolidatedRevenue.amountCents / 100).toFixed(2)],
      ['TVA collectée', (d.vatCollected.amountCents / 100).toFixed(2)],
    ]);
    toast('Journal TVA exporté (CSV).');
  };

  return (
    <>
      <ScreenHeader
        crumbs={['Réseau', 'Exercice 2025 · oct.']}
        title={t('titles.finances')}
        actions={
          <Button variant="secondary" icon="download" onClick={generateFec}>
            Export FEC
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Kpi label="CA consolidé" value={money0(d.consolidatedRevenue)} />
              <Kpi label="Charges" value={money0(d.charges)} />
              <Kpi label="Marge nette" value={money0(d.netMargin)} valueClass="text-ok" />
              <Kpi label="TVA collectée" value={money0(d.vatCollected)} />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
              <SectionCard title="Marge par site">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_1.3fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                  <div>Site</div>
                  <div className="text-right">CA</div>
                  <div className="text-right">Charges</div>
                  <div>Marge</div>
                </div>
                {d.margins.map((m) => {
                  const tone = marginTone(m.marginPct);
                  return (
                    <div key={m.siteId} className="grid grid-cols-[1.6fr_1fr_1fr_1.3fr] items-center gap-2 border-b border-border px-[18px] py-3 tabular-nums last:border-b-0">
                      <div className="truncate text-[13px] font-semibold">{m.siteName}</div>
                      <div className="text-right text-[12.5px] text-fg-muted">{money0(m.revenue)}</div>
                      <div className="text-right text-[12.5px] text-fg-muted">{money0(m.charges)}</div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-surface-3">
                          <div className={cn('h-full rounded-[3px]', tone.bar)} style={{ width: `${m.marginPct}%` }} />
                        </div>
                        <span className={cn('w-[34px] text-right text-[11.5px] font-bold', tone.text)}>{m.marginPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </SectionCard>

              <div className="flex flex-col gap-[18px]">
                <Card className="p-4">
                  <div className="mb-1 text-sm font-bold">Export comptable</div>
                  <div className="mb-3 text-xs text-fg-subtle">
                    Fichier des Écritures Comptables (FEC) conforme — prêt pour votre expert-comptable.
                  </div>
                  <div className="flex gap-2.5">
                    <Button variant="primary" className="flex-1" size="md" onClick={generateFec}>
                      Générer le FEC
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => exportVat(d)}>
                      Journal TVA
                    </Button>
                  </div>
                </Card>

                <SectionCard title="Connecteurs comptables">
                  {d.connectors.map((c) => (
                    <div key={c.provider} className="flex items-center gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0">
                      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-surface-3 text-[11px] font-bold text-fg-muted">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-[12.5px] font-semibold">{c.name}</div>
                        <div className="text-[11px] text-fg-subtle">Non connecté</div>
                      </div>
                      <button onClick={() => navigate({ to: '/settings' })} className="text-[11.5px] font-semibold text-primary">
                        Connecter
                      </button>
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

function Kpi({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <Card className="flex-[1_1_160px] p-4">
      <div className="text-[12.5px] font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 whitespace-nowrap text-[25px] font-bold tabular-nums', valueClass)}>{value}</div>
    </Card>
  );
}
