import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PriceSlot } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { money2 } from '@/lib/format';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const PROMO_DOT: Record<string, string> = { active: 'bg-ok', scheduled: 'bg-warn', draft: 'bg-fg-subtle' };
const PROMO_SUB: Record<string, string> = { active: 'active', scheduled: 'démarre lun.', draft: 'brouillon' };
const SLOT_COL: Partial<Record<PriceSlot, string>> = { offpeak: 'text-energy', peak: 'text-warn' };

export function Pricing() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['pricing'], queryFn: () => api.getPricing() });

  return (
    <>
      <ScreenHeader
        crumbs={[t('topbar.allSites'), 'Grille standard']}
        title={t('titles.pricing')}
        actions={
          <Button variant="primary" icon="arrowRight">
            Pousser les prix
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <SectionCard title="Grille tarifaire par créneau" className="mb-[18px]">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
                <div>Programme</div>
                <div className="text-right">Standard</div>
                <div className="text-right">Heures creuses</div>
                <div className="text-right">Pointe</div>
                <div className="text-right">Week-end</div>
              </div>
              {d.grid.map((row) => (
                <div key={row.programId} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-border px-[18px] py-3 tabular-nums last:border-b-0">
                  <div className="text-[13px] font-semibold">{row.programLabel}</div>
                  {(['standard', 'offpeak', 'peak', 'weekend'] as PriceSlot[]).map((slot) => (
                    <div key={slot} className={cn('text-right font-semibold', SLOT_COL[slot])}>
                      {row.prices[slot] ? money2(row.prices[slot]!) : '—'}
                    </div>
                  ))}
                </div>
              ))}
            </SectionCard>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.3fr_1fr]">
              <Card className="p-4">
                <div className="mb-1 text-sm font-bold">Tarification horaire (yield)</div>
                <div className="mb-3.5 text-xs text-fg-subtle">
                  Modulation sur 24 h — heures creuses encouragées pour lisser la charge énergétique.
                </div>
                <div className="flex h-[42px] overflow-hidden rounded-[10px] border border-border">
                  <Band w="33%" cls="bg-energy-soft text-energy" label="Creuse" />
                  <Band w="37%" cls="bg-surface-3 text-fg-muted" label="Standard" />
                  <Band w="17%" cls="bg-warn-soft text-warn" label="Pointe" />
                  <Band w="13%" cls="bg-energy-soft text-energy" label="Creuse" />
                </div>
                <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-fg-subtle">
                  <span>00 h</span>
                  <span>08 h</span>
                  <span>17 h</span>
                  <span>21 h</span>
                  <span>24 h</span>
                </div>
              </Card>

              <SectionCard title="Promotions programmées">
                {d.promotions.map((p) => (
                  <div key={p.id} className="flex items-center gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0">
                    <span className={cn('h-2 w-2 rounded-full', PROMO_DOT[p.status])} />
                    <div className="flex-1">
                      <div className="text-[12.5px] font-semibold">{p.label}</div>
                      <div className="text-[11px] text-fg-subtle">
                        {p.scopeLabel} · {PROMO_SUB[p.status]}
                      </div>
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

function Band({ w, cls, label }: { w: string; cls: string; label: string }) {
  return (
    <div className={cn('flex items-center justify-center text-[11px] font-bold', cls)} style={{ width: w }}>
      {label}
    </div>
  );
}
