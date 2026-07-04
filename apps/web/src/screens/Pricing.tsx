import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PriceSlot, PricingSummary, YieldBand } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const PROMO_DOT: Record<string, string> = { active: 'bg-ok', scheduled: 'bg-warn', draft: 'bg-fg-subtle' };
const PROMO_SUB: Record<string, string> = { active: 'active', scheduled: 'démarre lun.', draft: 'brouillon' };
const SLOT_COL: Partial<Record<PriceSlot, string>> = { offpeak: 'text-energy', peak: 'text-warn' };
const SLOTS: PriceSlot[] = ['standard', 'offpeak', 'peak', 'weekend'];
const SLOT_LABEL: Record<PriceSlot, string> = {
  standard: 'Standard',
  offpeak: 'Heures creuses',
  peak: 'Pointe',
  weekend: 'Week-end',
};
const BAND_CLS: Record<PriceSlot, string> = {
  offpeak: 'bg-energy-soft text-energy',
  standard: 'bg-surface-3 text-fg-muted',
  peak: 'bg-warn-soft text-warn',
  weekend: 'bg-primary-soft text-primary',
};

export function Pricing() {
  const { t } = useTranslation();
  const api = useApi();
  const { label } = useScope();
  const query = useQuery({ queryKey: ['pricing'], queryFn: () => api.getPricing() });

  return (
    <>
      <ScreenHeader crumbs={[label, 'Grille standard']} title={t('titles.pricing')} />
      <QueryBoundary query={query}>{(d) => <PricingBody d={d} scopeLabel={label} />}</QueryBoundary>
    </>
  );
}

function PricingBody({ d, scopeLabel }: { d: PricingSummary; scopeLabel: string }) {
  const { toast } = useToast();
  // Editable working copies seeded from the loaded grid / yield bands.
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      d.grid.map((row) => [
        row.programId,
        Object.fromEntries(
          SLOTS.map((s) => [s, row.prices[s] ? (row.prices[s]!.amountCents / 100).toFixed(2) : '']),
        ),
      ]),
    ),
  );
  const [bands, setBands] = useState<YieldBand[]>(() => d.yieldBands);
  const [editing, setEditing] = useState(false);

  const setPrice = (programId: string, slot: PriceSlot, value: string) =>
    setPrices((p) => ({ ...p, [programId]: { ...p[programId], [slot]: value } }));

  const setBand = (i: number, patch: Partial<YieldBand>) =>
    setBands((b) => b.map((band, idx) => (idx === i ? { ...band, ...patch } : band)));

  const saveGrid = () => {
    setEditing(false);
    toast(`Grille tarifaire enregistrée · ${scopeLabel}.`);
  };
  const saveBands = () => toast('Plages horaires (yield) enregistrées.');

  return (
    <>
      <SectionCard
        title="Grille tarifaire par créneau"
        subtitle="Configurez le prix de chaque programme par plage horaire."
        className="mb-[18px]"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" icon="check" onClick={saveGrid}>
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon="gear" onClick={() => setEditing(true)}>
              Modifier la grille
            </Button>
          )
        }
      >
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
          <div>Programme</div>
          {SLOTS.map((s) => (
            <div key={s} className="text-right">
              {SLOT_LABEL[s]}
            </div>
          ))}
        </div>
        {d.grid.map((row) => (
          <div
            key={row.programId}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-border px-[18px] py-3 tabular-nums last:border-b-0"
          >
            <div className="text-[13px] font-semibold">{row.programLabel}</div>
            {SLOTS.map((slot) => (
              <div key={slot} className="text-right">
                {editing ? (
                  <input
                    type="number"
                    step="0.10"
                    value={prices[row.programId]?.[slot] ?? ''}
                    onChange={(e) => setPrice(row.programId, slot, e.target.value)}
                    className="h-[32px] w-[74px] rounded-[8px] border border-border bg-surface px-2 text-right text-[13px] tabular-nums outline-none focus:border-primary"
                  />
                ) : (
                  <span className={cn('font-semibold', SLOT_COL[slot])}>
                    {prices[row.programId]?.[slot] ? `${prices[row.programId]![slot]} €` : '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </SectionCard>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-bold">Tarification horaire (yield)</div>
            <Button variant="ghost" size="sm" onClick={saveBands}>
              Enregistrer
            </Button>
          </div>
          <div className="mb-3.5 text-xs text-fg-subtle">
            Modulez les prix sur 24 h — les heures creuses lissent la charge énergétique.
          </div>
          <div className="flex h-[42px] overflow-hidden rounded-[10px] border border-border">
            {bands.map((b, i) => (
              <div
                key={i}
                className={cn('flex items-center justify-center text-[11px] font-bold', BAND_CLS[b.slot])}
                style={{ width: `${((b.toHour - b.fromHour) / 24) * 100}%` }}
              >
                {SLOT_LABEL[b.slot]}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {bands.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px]">
                <select
                  value={b.slot}
                  onChange={(e) => setBand(i, { slot: e.target.value as PriceSlot })}
                  className="h-[32px] flex-1 rounded-[8px] border border-border bg-surface px-2 outline-none focus:border-primary"
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABEL[s]}
                    </option>
                  ))}
                </select>
                <span className="text-fg-subtle">de</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={b.fromHour}
                  onChange={(e) => setBand(i, { fromHour: Number(e.target.value) })}
                  className="h-[32px] w-[58px] rounded-[8px] border border-border bg-surface px-2 text-right tabular-nums outline-none focus:border-primary"
                />
                <span className="text-fg-subtle">à</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={b.toHour}
                  onChange={(e) => setBand(i, { toHour: Number(e.target.value) })}
                  className="h-[32px] w-[58px] rounded-[8px] border border-border bg-surface px-2 text-right tabular-nums outline-none focus:border-primary"
                />
                <span className="text-fg-subtle">h</span>
              </div>
            ))}
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
  );
}
