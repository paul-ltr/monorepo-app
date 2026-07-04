import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  PriceSlot,
  PricingSummary,
  Promotion,
  PromotionStatus,
  PromotionType,
  Weekday,
  YieldBand,
} from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { Button, Modal, Pill, ScreenHeader, SectionCard, Segmented, Switch } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

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
const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'mon', label: 'Lun' },
  { value: 'tue', label: 'Mar' },
  { value: 'wed', label: 'Mer' },
  { value: 'thu', label: 'Jeu' },
  { value: 'fri', label: 'Ven' },
  { value: 'sat', label: 'Sam' },
  { value: 'sun', label: 'Dim' },
];
const PROMO_STATUS: Record<PromotionStatus, { label: string; dot: string }> = {
  active: { label: 'Active', dot: 'bg-ok' },
  scheduled: { label: 'Programmée', dot: 'bg-warn' },
  draft: { label: 'Brouillon', dot: 'bg-fg-subtle' },
  paused: { label: 'En pause', dot: 'bg-fg-subtle' },
};
const PROMO_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'percentage', label: 'Remise %' },
  { value: 'amount', label: 'Remise €' },
  { value: 'bonus', label: 'Cycle offert' },
];

const promoValue = (p: Promotion) =>
  p.type === 'percentage'
    ? `−${p.value} %`
    : p.type === 'amount'
      ? `−${(p.value / 100).toFixed(2)} €`
      : `${p.value} cycle${p.value > 1 ? 's' : ''} offert${p.value > 1 ? 's' : ''}`;

const field = 'h-[38px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary';

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
  const api = useApi();
  const qc = useQueryClient();
  const { sites } = useScope();

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
  const [editing, setEditing] = useState(false);

  // Per-day yield schedule (all 7 days present).
  const [schedule, setSchedule] = useState<Record<Weekday, YieldBand[]>>(() => {
    const base = {} as Record<Weekday, YieldBand[]>;
    for (const w of WEEKDAYS) base[w.value] = (d.yieldSchedule[w.value] ?? []).map((b) => ({ ...b }));
    return base;
  });
  const [day, setDay] = useState<Weekday>('mon');
  const bands = schedule[day];

  const [showNewPromo, setShowNewPromo] = useState(false);

  const setPrice = (programId: string, slot: PriceSlot, value: string) =>
    setPrices((p) => ({ ...p, [programId]: { ...p[programId], [slot]: value } }));

  const setBand = (i: number, patch: Partial<YieldBand>) =>
    setSchedule((s) => ({ ...s, [day]: s[day].map((band, idx) => (idx === i ? { ...band, ...patch } : band)) }));
  const addBand = () =>
    setSchedule((s) => ({ ...s, [day]: [...s[day], { slot: 'standard', fromHour: 0, toHour: 24 }] }));
  const removeBand = (i: number) =>
    setSchedule((s) => ({ ...s, [day]: s[day].filter((_, idx) => idx !== i) }));
  const copyToAllDays = () =>
    setSchedule((s) => {
      const copy = s[day].map((b) => ({ ...b }));
      const next = {} as Record<Weekday, YieldBand[]>;
      for (const w of WEEKDAYS) next[w.value] = copy.map((b) => ({ ...b }));
      return next;
    });

  const saveGrid = () => {
    setEditing(false);
    toast(`Grille tarifaire enregistrée · ${scopeLabel}.`);
  };
  const dayLabel = WEEKDAYS.find((w) => w.value === day)!.label;
  const saveBands = () => toast(`Tarification horaire (${dayLabel}) enregistrée.`);

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PromotionStatus }) => api.setPromotionStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });

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
        <SectionCard
          title="Tarification horaire (yield)"
          subtitle="Modulez les prix par jour et par plage — les heures creuses lissent la charge énergétique."
          action={
            <Button variant="ghost" size="sm" onClick={saveBands}>
              Enregistrer
            </Button>
          }
          bodyClassName="p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented ariaLabel="Jour" size="sm" value={day} onChange={setDay} options={WEEKDAYS} />
            <Button variant="subtle" size="sm" icon="check" onClick={copyToAllDays}>
              Appliquer à tous les jours
            </Button>
          </div>

          <div className="flex h-[42px] overflow-hidden rounded-[10px] border border-border">
            {bands.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[11px] text-fg-subtle">
                Aucune plage — tarif standard toute la journée.
              </div>
            ) : (
              bands.map((b, i) => (
                <div
                  key={i}
                  className={cn('flex items-center justify-center text-[11px] font-bold', BAND_CLS[b.slot])}
                  style={{ width: `${(Math.max(0, b.toHour - b.fromHour) / 24) * 100}%` }}
                >
                  {SLOT_LABEL[b.slot]}
                </div>
              ))
            )}
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
                <button
                  onClick={() => removeBand(i)}
                  aria-label="Supprimer la plage"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-fg-subtle hover:border-danger hover:text-danger"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
            <Button variant="subtle" size="sm" icon="plus" onClick={addBand} className="self-start">
              Ajouter une plage
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Promotions & remises"
          action={
            <Button variant="secondary" size="sm" icon="plus" onClick={() => setShowNewPromo(true)}>
              Nouvelle
            </Button>
          }
        >
          {d.promotions.length === 0 ? (
            <div className="px-[17px] py-6 text-center text-[12.5px] text-fg-subtle">Aucune promotion.</div>
          ) : (
            d.promotions.map((p) => {
              const st = PROMO_STATUS[p.status];
              return (
                <div key={p.id} className="flex items-center gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', st.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{p.label}</div>
                    <div className="text-[11px] text-fg-subtle">
                      {p.scopeLabel} · {promoValue(p)} · {st.label}
                    </div>
                  </div>
                  <Switch
                    checked={p.status === 'active'}
                    disabled={toggleStatus.isPending}
                    onChange={(on) => toggleStatus.mutate({ id: p.id, status: on ? 'active' : 'paused' })}
                  />
                </div>
              );
            })
          )}
        </SectionCard>
      </div>

      <NewPromotionModal
        open={showNewPromo}
        onClose={() => setShowNewPromo(false)}
        scopeOptions={['Tous les sites', ...sites.map((s) => s.name), 'Réseau']}
        onCreated={(label) => {
          qc.invalidateQueries({ queryKey: ['pricing'] });
          toast(`Promotion « ${label} » créée.`);
        }}
      />
    </>
  );
}

function NewPromotionModal({
  open,
  onClose,
  scopeOptions,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  scopeOptions: string[];
  onCreated: (label: string) => void;
}) {
  const api = useApi();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<PromotionType>('percentage');
  const [value, setValue] = useState('20');
  const [scopeLabel, setScopeLabel] = useState(scopeOptions[0] ?? 'Tous les sites');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'active'>('draft');

  const create = useMutation({
    mutationFn: () => {
      const raw = Number(value) || 0;
      const v = type === 'amount' ? Math.round(raw * 100) : Math.round(raw);
      return api.createPromotion({ label: label.trim(), type, value: v, scopeLabel, status });
    },
  });

  const reset = () => {
    setLabel('');
    setType('percentage');
    setValue('20');
    setStatus('draft');
    create.reset();
  };

  const valid = label.trim().length >= 2 && Number(value) > 0;
  const submit = () => {
    if (!valid) return;
    create.mutate(undefined, {
      onSuccess: () => {
        onCreated(label.trim());
        reset();
        onClose();
      },
    });
  };

  const unit = type === 'percentage' ? '%' : type === 'amount' ? '€' : 'cycles offerts';

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="tag"
      title="Nouvelle promotion"
      subtitle="Créez une remise et choisissez son état."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? 'Création…' : 'Créer la promotion'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-fg-subtle">Intitulé</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. −20 % séchage mardi" className={field} maxLength={80} />
        </label>
        <div>
          <span className="mb-1.5 block text-[11.5px] font-semibold text-fg-subtle">Type</span>
          <Segmented value={type} onChange={setType} options={PROMO_TYPES} size="sm" />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-fg-subtle">Valeur ({unit})</span>
            <input type="number" min={0} step={type === 'amount' ? '0.10' : '1'} value={value} onChange={(e) => setValue(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-fg-subtle">Périmètre</span>
            <select value={scopeLabel} onChange={(e) => setScopeLabel(e.target.value)} className={field}>
              {scopeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="mb-1.5 block text-[11.5px] font-semibold text-fg-subtle">État initial</span>
          <Segmented
            value={status}
            onChange={setStatus}
            size="sm"
            options={[
              { value: 'draft', label: 'Brouillon' },
              { value: 'scheduled', label: 'Programmée' },
              { value: 'active', label: 'Active' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-fg-subtle">
          <Pill tone="primary">Aperçu</Pill>
          {label.trim() || 'Nouvelle promotion'} · {scopeLabel}
        </div>
        {create.isError && <div className="text-[12px] font-semibold text-danger">Échec de la création — réessayez.</div>}
      </div>
    </Modal>
  );
}
