import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { Site, SiteRanking } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { useScope } from '@/lib/scope';
import { money0, pct } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button, Card, InfoButton, Modal, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
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

const SITE_STATUS: Record<string, { label: string; c: string; bg: string }> = {
  active: { label: 'Actif', c: 'text-ok', bg: 'bg-ok-soft' },
  paused: { label: 'En pause', c: 'text-warn', bg: 'bg-warn-soft' },
  closed: { label: 'Fermé', c: 'text-fg-subtle', bg: 'bg-surface-3' },
};

export function Reseau() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const session = useSession();
  const { toast } = useToast();
  const { scope, selectSite } = useScope();
  const orgName = session.data?.tenant.name ?? 'Groupe Lavomatique';
  const query = useQuery({ queryKey: ['network'], queryFn: () => api.getNetwork() });
  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: () => api.getSites() });
  const [showInvoice, setShowInvoice] = useState(false);

  const openSite = (rk: SiteRanking) => {
    selectSite(rk.siteId);
    navigate({ to: '/' });
  };

  const downloadReport = (ranking: SiteRanking[]) => {
    downloadCsv(
      'rapport-reseau.csv',
      ['Rang', 'Site', 'CA 30j (€)', 'Indice benchmark', 'Écart vs pairs (%)'],
      ranking.map((r) => [r.rank, r.name, (r.revenue.amountCents / 100).toFixed(2), r.index, r.deltaPct]),
    );
    toast('Rapport réseau exporté (CSV).');
  };

  return (
    <>
      <ScreenHeader
        crumbs={[orgName, scope.type === 'all' ? 'Réseau · 6 sites' : scope.name]}
        title={t('titles.reseau')}
        actions={
          <Button variant="secondary" icon="file" onClick={() => query.data && downloadReport(query.data.ranking)}>
            Rapport réseau
          </Button>
        }
      />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <Kpi
                label="CA réseau · 30 j"
                value={money0(d.revenue30d)}
                info="Somme des recettes encaissées (CB, sans contact, espèces) sur l’ensemble des sites du réseau, glissant sur 30 jours. Source : réconciliation monétique."
              />
              <Kpi
                label="Indice benchmark"
                value={<>{d.benchmarkIndex}<span className="text-sm font-semibold text-fg-subtle"> /100</span></>}
                info="Score /100 situant le réseau face à un panel de laveries comparables (CA/m², taux d’occupation, disponibilité). 100 = tête de panel ; 50 = médiane."
              />
              <Kpi
                label="Sites en alerte"
                value={d.sitesInAlert}
                valueClass="text-danger"
                info="Nombre de sites avec au moins une anomalie ouverte : machine hors service, écart de caisse non réconcilié ou surconsommation détectée."
              />
              <Kpi
                label="Redevances dues"
                value={money0(d.royaltiesDue)}
                info="Redevances de franchise dues sur la période, calculées comme CA du réseau × taux de redevance configuré. Modifiable via « Émettre la facture »."
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">
              <SectionCard title="Classement des sites · indice benchmark">
                {d.ranking.map((rk) => {
                  const m = medal(rk.rank);
                  const tone = idxTone(rk.index);
                  const isActive = scope.type === 'site' && scope.siteId === rk.siteId;
                  return (
                    <button
                      key={rk.siteId}
                      onClick={() => openSite(rk)}
                      title={`Ouvrir ${rk.name}`}
                      className={cn(
                        'flex w-full items-center gap-[13px] border-b border-border px-[18px] py-[13px] text-left last:border-b-0 hover:bg-surface-2',
                        isActive && 'bg-primary-soft',
                      )}
                    >
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
                      <Icon name="chevronRight" size={15} className="text-fg-subtle" strokeWidth={2} />
                    </button>
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
                    <button
                      onClick={() => {
                        const site = sitesQuery.data?.find((s) => s.name === d.exception!.siteName);
                        if (site) selectSite(site.id);
                        navigate({ to: '/' });
                      }}
                      className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                    >
                      Ouvrir {d.exception.siteName}
                      <Icon name="arrowRight" size={14} strokeWidth={2} />
                    </button>
                  </Card>
                )}

                <Card className="p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="text-sm font-bold">Redevances · oct.</div>
                    <button
                      onClick={() => setShowInvoice(true)}
                      className="text-[11.5px] font-semibold text-primary hover:underline"
                    >
                      Émettre la facture
                    </button>
                  </div>
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
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="text-sm font-bold">Standardisation</div>
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-fg-subtle">
                      <Icon name="clock" size={12} />
                      Bientôt disponible
                    </span>
                  </div>
                  <div className="text-[12.5px] leading-[1.5] text-fg-muted">{d.standardizationLabel}</div>
                  <div className="mt-2 text-[11px] text-fg-subtle">
                    La diffusion automatique du référentiel d’enseigne arrive prochainement.
                  </div>
                </Card>
              </div>
            </div>

            <SitesManager sites={sitesQuery.data ?? []} onOpen={(id) => { selectSite(id); navigate({ to: '/' }); }} />

            <RoyaltyInvoiceModal
              open={showInvoice}
              onClose={() => setShowInvoice(false)}
              networkRevenue={d.revenue30d}
              orgName={orgName}
            />
          </>
        )}
      </QueryBoundary>
    </>
  );
}

/**
 * M9 — royalties invoice: back-office editing of the royalty rate + a preview
 * and editable e-mail to franchisees before issuing. Sending is simulated in the
 * mock; a live build posts to core.royalty_invoice + the mailer.
 */
function RoyaltyInvoiceModal({
  open,
  onClose,
  networkRevenue,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  networkRevenue: { amountCents: number; currency: string };
  orgName: string;
}) {
  const { toast } = useToast();
  const [ratePct, setRatePct] = useState('5');
  const period = 'octobre 2025';
  const amountCents = Math.round((networkRevenue.amountCents * (Number(ratePct) || 0)) / 100);
  const amount = { amountCents, currency: networkRevenue.currency };

  const [subject, setSubject] = useState(`Facture de redevances — ${period}`);
  const [body, setBody] = useState('');
  // Keep the e-mail body in sync with the computed figures until the user edits it.
  const [bodyEdited, setBodyEdited] = useState(false);

  // Reset the editable fields each time the modal opens.
  useEffect(() => {
    if (open) {
      setRatePct('5');
      setSubject(`Facture de redevances — ${period}`);
      setBody('');
      setBodyEdited(false);
    }
  }, [open]);
  const computedBody =
    `Bonjour,\n\nVeuillez trouver la facture de redevances de franchise pour ${period}.\n\n` +
    `Base (CA réseau 30 j) : ${money0(networkRevenue)}\n` +
    `Taux de redevance : ${ratePct} %\n` +
    `Montant dû : ${money0(amount)}\n\n` +
    `Le règlement est attendu sous 30 jours.\n\nCordialement,\n${orgName}`;
  const effectiveBody = bodyEdited ? body : computedBody;

  const send = () => {
    toast(`Facture de redevances (${money0(amount)} · ${ratePct} %) émise et transmise aux franchisés.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="bank"
      title="Émettre la facture de redevances"
      subtitle={`Période ${period} · aperçu et e-mail avant envoi`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="arrowRight" onClick={send}>
            Émettre &amp; envoyer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[11px] border border-border bg-surface-2 p-3.5">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.3px] text-fg-subtle">Aperçu de la facture</div>
          <div className="flex items-center justify-between py-1 text-[12.5px]">
            <span className="text-fg-muted">Base · CA réseau 30 j</span>
            <span className="font-semibold tabular-nums">{money0(networkRevenue)}</span>
          </div>
          <label className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
            <span className="text-fg-muted">Taux de redevance (back-office)</span>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                className="h-[32px] w-[70px] rounded-[8px] border border-border bg-surface px-2 text-right tabular-nums outline-none focus:border-primary"
              />
              <span className="text-fg-subtle">%</span>
            </span>
          </label>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-[13px]">
            <span className="font-semibold">Montant dû</span>
            <span className="font-bold tabular-nums text-primary">{money0(amount)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-fg-subtle">Objet de l’e-mail</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-[38px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-fg-subtle">Corps de l’e-mail (modifiable)</span>
          <textarea
            value={effectiveBody}
            onChange={(e) => {
              setBodyEdited(true);
              setBody(e.target.value);
            }}
            rows={9}
            className="w-full resize-none rounded-[9px] border border-border bg-surface px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus:border-primary"
          />
        </label>
      </div>
    </Modal>
  );
}

/** M9/M12 — the sites registry: list, filter, open, and add (mock) network sites. */
function SitesManager({ sites, onOpen }: { sites: Site[]; onOpen: (siteId: string) => void }) {
  const { toast } = useToast();
  const [added, setAdded] = useState<Site[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [surface, setSurface] = useState('');

  const all = [...sites, ...added];

  const submit = () => {
    if (!name.trim()) return;
    const site: Site = {
      id: `local-${added.length + 1}`,
      tenantId: sites[0]?.tenantId ?? 'local',
      networkId: sites[0]?.networkId ?? null,
      name: name.trim(),
      address: null,
      city: city.trim() || null,
      postalCode: null,
      lat: null,
      lng: null,
      surfaceM2: surface ? Number(surface) : null,
      timezone: 'Europe/Paris',
      status: 'paused',
      openedAt: null,
    };
    setAdded((a) => [...a, site]);
    setName('');
    setCity('');
    setSurface('');
    setShowForm(false);
    toast(`Site « ${site.name} » ajouté au réseau.`);
  };

  return (
    <SectionCard
      className="mt-[18px]"
      title="Sites du réseau"
      subtitle={`${all.length} sites · gestion du parc, périmètres et conformité`}
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setShowForm((s) => !s)}>
          Ajouter un site
        </Button>
      }
    >
      {showForm && (
        <div className="flex flex-wrap items-end gap-3 border-b border-border bg-surface-2 px-[18px] py-3.5">
          <Field label="Nom du site" value={name} onChange={setName} placeholder="Lyon-8 Monplaisir" wide />
          <Field label="Ville" value={city} onChange={setCity} placeholder="Lyon" />
          <Field label="Surface (m²)" value={surface} onChange={setSurface} placeholder="150" type="number" />
          <Button variant="primary" size="md" onClick={submit} disabled={!name.trim()}>
            Enregistrer
          </Button>
          <Button variant="secondary" size="md" onClick={() => setShowForm(false)}>
            Annuler
          </Button>
        </div>
      )}
      <div className="grid grid-cols-[1.6fr_1fr_.8fr_.9fr] gap-2 border-b border-border px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.3px] text-fg-subtle">
        <div>Site</div>
        <div>Ville</div>
        <div className="text-right">Surface</div>
        <div className="text-right">Statut</div>
      </div>
      {all.map((s) => {
        const st = SITE_STATUS[s.status] ?? SITE_STATUS.active!;
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="grid w-full grid-cols-[1.6fr_1fr_.8fr_.9fr] items-center gap-2 border-b border-border px-[18px] py-3 text-left last:border-b-0 hover:bg-surface-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] bg-surface-3 text-fg-muted">
                <Icon name="mapPin" size={15} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{s.name}</div>
                {s.address && <div className="truncate text-[11px] text-fg-subtle">{s.address}</div>}
              </div>
            </div>
            <div className="truncate text-[12.5px] text-fg-muted">{s.city ?? '—'}</div>
            <div className="text-right text-[12.5px] tabular-nums text-fg-muted">{s.surfaceM2 ? `${s.surfaceM2} m²` : '—'}</div>
            <div className="flex justify-end">
              <span className={cn('rounded-[7px] px-[9px] py-1 text-[11px] font-bold', st.bg, st.c)}>{st.label}</span>
            </div>
          </button>
        );
      })}
    </SectionCard>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={cn('flex flex-col gap-1', wide ? 'min-w-[200px] flex-1' : 'w-[130px]')}>
      <span className="text-[11px] font-semibold text-fg-subtle">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[38px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-fg outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-soft)]"
      />
    </label>
  );
}

function Kpi({
  label,
  value,
  valueClass,
  info,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  info?: string;
}) {
  return (
    <Card className="flex-[1_1_160px] p-4">
      <div className="flex items-center gap-1 text-[12.5px] font-semibold text-fg-muted">
        {label}
        {info && <InfoButton label={info} />}
      </div>
      <div className={cn('mt-1.5 whitespace-nowrap text-[25px] font-bold tabular-nums', valueClass)}>{value}</div>
    </Card>
  );
}
