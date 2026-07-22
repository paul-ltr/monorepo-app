import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CampaignChannel, CampaignStatus, LoyaltyTier } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { money0, num } from '@/lib/format';
import { Card, ProgressBar, ScreenHeader, StatCard } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

const TIER_META: Record<LoyaltyTier, { label: string; cls: string }> = {
  gold: { label: 'Or', cls: 'text-warn' },
  silver: { label: 'Argent', cls: 'text-fg-muted' },
  bronze: { label: 'Bronze', cls: 'text-energy' },
};
const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  sms: 'SMS',
  email: 'E-mail',
  push: 'Push',
};
const CAMPAIGN_META: Record<CampaignStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-ok-soft text-ok' },
  scheduled: { label: 'Planifiée', cls: 'bg-info-soft text-info' },
  draft: { label: 'Brouillon', cls: 'bg-surface-3 text-fg-subtle' },
};

/** Clients & fidélité — descriptive read-only view (segments, loyalty, campaigns). */
export function Clients() {
  const { t } = useTranslation();
  const api = useApi();
  const { isAll, label } = useScope();
  const query = useQuery({ queryKey: ['customers'], queryFn: () => api.getCustomers() });

  return (
    <>
      <ScreenHeader crumbs={[isAll ? t('topbar.allSites') : label]} title={t('titles.clients')} />

      <QueryBoundary query={query}>
        {(d) => {
          const tierTotal = d.loyaltyTiers.reduce((s, x) => s + x.count, 0);
          return (
            <>
              <div className="mb-[18px] flex flex-wrap gap-3.5">
                <StatCard
                  label="Clients actifs"
                  icon="users"
                  iconClass="text-primary"
                  value={num(d.activeCustomers)}
                />
                <StatCard
                  label="Taux de fidélité"
                  icon="thumbsUp"
                  iconClass="text-ok"
                  value={`${d.loyaltyRatePct} %`}
                />
                <StatCard
                  label="Parrainages (30 j)"
                  icon="users"
                  iconClass="text-info"
                  value={num(d.referrals30d)}
                />
                <StatCard
                  label="Cagnotte totale"
                  icon="euro"
                  iconClass="text-energy"
                  value={money0(d.walletTotal)}
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
                {/* Segments */}
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                    Segments
                  </div>
                  {d.segments.map((s) => (
                    <div
                      key={s.id}
                      className="border-b border-border px-[18px] py-3 last:border-b-0"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-semibold">{s.name}</span>
                        <span className="flex-shrink-0 text-[12px] font-bold tabular-nums">
                          {num(s.count)}
                        </span>
                      </div>
                      <ProgressBar value={s.sharePct} tone="primary" />
                      <div className="mt-1 text-[11px] text-fg-subtle">{s.definitionLabel}</div>
                    </div>
                  ))}
                </Card>

                {/* Programme fidélité */}
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-[18px] py-3 text-[15px] font-bold">
                    Programme fidélité
                  </div>
                  <div className="flex flex-col gap-3 p-[18px]">
                    {d.loyaltyTiers.map((tier) => (
                      <div key={tier.tier} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'w-16 flex-shrink-0 text-[12.5px] font-bold',
                            TIER_META[tier.tier].cls,
                          )}
                        >
                          {TIER_META[tier.tier].label}
                        </span>
                        <ProgressBar
                          value={tierTotal ? (tier.count / tierTotal) * 100 : 0}
                          tone="warn"
                          className="flex-1"
                        />
                        <span className="w-12 flex-shrink-0 text-right text-[12px] font-semibold tabular-nums">
                          {num(tier.count)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border px-[18px] py-3 text-[15px] font-bold">
                    Campagnes
                  </div>
                  {d.campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 border-b border-border px-[18px] py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold">{c.label}</div>
                        <div className="truncate text-[11px] text-fg-subtle">
                          {CHANNEL_LABEL[c.channel]} · {c.audienceLabel}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'flex-shrink-0 rounded-[7px] px-2 py-0.5 text-[11px] font-bold',
                          CAMPAIGN_META[c.status].cls,
                        )}
                      >
                        {CAMPAIGN_META[c.status].label}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
