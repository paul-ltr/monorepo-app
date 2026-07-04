import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CampaignChannel, CustomersSummary, LoyaltyTier } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { money0, num, pct } from '@/lib/format';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const SEG_COLOR = ['var(--ok)', 'var(--info)', 'var(--warn)', 'var(--primary)'];
const TIER_LABEL: Record<LoyaltyTier, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };
const CHAN_DOT: Record<CampaignChannel, string> = { sms: 'bg-ok', email: 'bg-warn', push: 'bg-info' };
const CHAN_C: Record<string, string> = { active: 'text-ok', draft: 'text-warn', scheduled: 'text-info' };
const CHAN_LABEL: Record<string, string> = { active: 'Active', draft: 'Brouillon', scheduled: 'Programmée' };

export function Clients() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['customers'], queryFn: () => api.getCustomers() });

  return (
    <>
      <ScreenHeader crumbs={['Réseau', 'Base clients']} title={t('titles.clients')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Kpi label="Clients actifs" value={num(d.activeCustomers)} />
              <Kpi label="Cagnotte totale" value={money0(d.walletTotal)} />
              <Kpi label="Taux de fidélité" value={pct(d.loyaltyRatePct, false)} valueClass="text-ok" />
              <Kpi label="Parrainages 30 j" value={num(d.referrals30d)} />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
              <Card className="p-4">
                <div className="mb-4 text-sm font-bold">Segments clients</div>
                <div className="flex flex-col gap-4">
                  {d.segments.map((g, i) => (
                    <div key={g.id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                          <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: SEG_COLOR[i % 4] }} />
                          {g.name}
                        </span>
                        <span className="text-[13px] font-bold tabular-nums">{num(g.count)}</span>
                      </div>
                      <div className="mb-[3px] h-[7px] overflow-hidden rounded-[4px] bg-surface-3">
                        <div className="h-full rounded-[4px]" style={{ width: `${g.sharePct}%`, background: SEG_COLOR[i % 4] }} />
                      </div>
                      <div className="text-[11px] text-fg-subtle">{g.definitionLabel}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex flex-col gap-[18px]">
                <LoyaltyConfig d={d} />
                <CampaignsCard d={d} />
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}

/** Configurable loyalty program: earn rate + tier thresholds (mock persistence). */
function LoyaltyConfig({ d }: { d: CustomersSummary }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [pointsPerEuro, setPointsPerEuro] = useState('1');
  const [thresholds, setThresholds] = useState<Record<LoyaltyTier, string>>({
    bronze: '0',
    silver: '150',
    gold: '500',
  });

  const save = () => {
    setEditing(false);
    toast('Programme de fidélité mis à jour.');
  };

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,var(--primary-soft),var(--surface))' }} />
      <div className="relative">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-sm font-bold">Programme fidélité</div>
          {editing ? (
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" icon="check" onClick={save}>
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Configurer
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="text-fg-muted">Points par euro dépensé</span>
              <input
                type="number"
                step="0.5"
                value={pointsPerEuro}
                onChange={(e) => setPointsPerEuro(e.target.value)}
                className="h-[32px] w-[80px] rounded-[8px] border border-border bg-surface px-2 text-right tabular-nums outline-none focus:border-primary"
              />
            </label>
            {(['bronze', 'silver', 'gold'] as LoyaltyTier[]).map((tier) => (
              <label key={tier} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-fg-muted">Palier {TIER_LABEL[tier]} · à partir de</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={thresholds[tier]}
                    onChange={(e) => setThresholds((th) => ({ ...th, [tier]: e.target.value }))}
                    className="h-[32px] w-[80px] rounded-[8px] border border-border bg-surface px-2 text-right tabular-nums outline-none focus:border-primary"
                  />
                  <span className="text-fg-subtle">pts</span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <>
            <div className="text-[12.5px] leading-[1.5] text-fg-muted">
              {pointsPerEuro} point / € dépensé · paliers Bronze ({thresholds.bronze}) / Argent ({thresholds.silver}) / Or (
              {thresholds.gold}) pts. {pct(d.loyaltyRatePct, false)} des clients actifs disposent d'une cagnotte.
            </div>
            <div className="mt-3 flex gap-2">
              {d.loyaltyTiers.map((tier) => (
                <div key={tier.tier} className="flex-1 rounded-[9px] border border-border bg-surface p-2 text-center">
                  <div className="text-[11px] text-fg-subtle">{TIER_LABEL[tier.tier]}</div>
                  <div className="font-bold tabular-nums">{num(tier.count)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Campaigns list with activate/pause toggling (mock). */
function CampaignsCard({ d }: { d: CustomersSummary }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.campaigns.map((c) => [c.id, c.status])),
  );
  const toggle = (id: string, label: string) => {
    setStatus((s) => {
      const next = s[id] === 'active' ? 'draft' : 'active';
      toast(next === 'active' ? `Campagne « ${label} » activée.` : `Campagne « ${label} » mise en pause.`);
      return { ...s, [id]: next };
    });
  };
  return (
    <SectionCard title="Campagnes">
      {d.campaigns.map((c) => {
        const st = status[c.id] ?? c.status;
        return (
          <div key={c.id} className="flex items-center gap-[11px] border-b border-border px-[17px] py-3 last:border-b-0">
            <span className={cn('h-2 w-2 rounded-full', CHAN_DOT[c.channel])} />
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold">{c.label}</div>
              <div className="text-[11px] text-fg-subtle">{c.audienceLabel}</div>
            </div>
            <span className={cn('text-[11px] font-semibold', CHAN_C[st])}>{CHAN_LABEL[st]}</span>
            <button
              onClick={() => toggle(c.id, c.label)}
              className="rounded-[7px] border border-border px-2 py-1 text-[11px] font-semibold text-fg-muted hover:border-border-strong"
            >
              {st === 'active' ? 'Pause' : 'Activer'}
            </button>
          </div>
        );
      })}
    </SectionCard>
  );
}

function Kpi({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <Card className="flex-[1_1_160px] p-4">
      <div className="text-[12.5px] font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 text-[26px] font-bold tabular-nums', valueClass)}>{value}</div>
    </Card>
  );
}
