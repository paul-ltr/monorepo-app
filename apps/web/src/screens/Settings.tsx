import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ConnectorHistory, ConnectorStatus, EnedisMeterKind } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { useAppParams, emptySiteParams, type SiteParams } from '@/lib/params';
import { Button, Card, ScreenHeader, SectionCard, Segmented, Switch } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AddressField } from '@/components/AddressField';
import { useToast } from '@/components/Toast';
import { QueryBoundary } from '@/components/state';
import { cn } from '@/lib/cn';

/** Keep only the leading 14 digits (Enedis PDL / GRDF PCE format). */
const digits14 = (s: string) => s.replace(/\D/g, '').slice(0, 14);

const TONE: Record<ConnectorStatus, { label: string; c: string; bg: string; btn: string; solid: boolean }> = {
  connected: { label: 'Connecté', c: 'text-ok', bg: 'bg-ok-soft', btn: 'Gérer', solid: false },
  connecting: { label: 'Connexion…', c: 'text-info', bg: 'bg-info-soft', btn: 'Connexion…', solid: false },
  error: { label: 'Erreur', c: 'text-danger', bg: 'bg-danger-soft', btn: 'Reconnecter', solid: true },
  not_connected: { label: 'Non connecté', c: 'text-fg-subtle', bg: 'bg-surface-3', btn: 'Connecter', solid: true },
};

export function Settings() {
  const { t } = useTranslation();
  const api = useApi();
  const query = useQuery({ queryKey: ['admin'], queryFn: () => api.getAdmin() });
  const [overrides, setOverrides] = useState<Record<string, ConnectorStatus>>({});

  const connect = (id: string) => {
    setOverrides((o) => ({ ...o, [id]: 'connecting' }));
    setTimeout(() => setOverrides((o) => ({ ...o, [id]: 'connected' })), 1400);
  };

  return (
    <>
      <ScreenHeader crumbs={['Groupe Lavomatique', 'Administration']} title={t('titles.settings')} />

      <QueryBoundary query={query}>
        {(d) => (
          <>
            <Card className="mb-[18px] p-[18px_20px]">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-base font-bold">Connectez vos outils</div>
                <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <span className="h-[7px] w-[7px] rounded-full bg-ok" />8 connectés · 1 en erreur
                </span>
              </div>
              <div className="mb-[18px] text-[12.5px] text-fg-subtle">
                Centrales de paiement, machines, IA, comptabilité, énergie et messagerie. Les secrets sont stockés dans AWS
                Secrets Manager — jamais en clair.
              </div>
              <div className="flex flex-col gap-5">
                {d.connectors.map((cat) => {
                  // Enedis is configured per site (PDL entry below), not as a tool connector.
                  const items = cat.items.filter((it) => !/enedis/i.test(it.name));
                  if (items.length === 0) return null;
                  return (
                  <div key={cat.group}>
                    <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-fg-subtle">{cat.group}</div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
                      {items.map((it) => {
                        const status = overrides[it.id] ?? it.status;
                        const tone = TONE[status];
                        const active = status === 'not_connected' || status === 'error';
                        return (
                          <div key={it.id} className="rounded-[12px] border border-border bg-surface-2 p-3.5">
                            <div className="mb-3 flex items-center gap-[11px]">
                              <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-[12px] font-bold text-fg-muted">
                                {it.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-semibold">{it.name}</div>
                                <div className="truncate text-[11px] text-fg-subtle">{it.kindLabel}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-bold', tone.bg, tone.c)}>
                                <span className={cn('h-[7px] w-[7px] rounded-full bg-current', status === 'connecting' && 'animate-pl-pulse')} />
                                {tone.label}
                              </span>
                              <button
                                onClick={() => active && connect(it.id)}
                                className={cn(
                                  'h-[30px] rounded-[8px] px-[13px] text-[12px] font-semibold',
                                  tone.solid ? 'bg-primary text-primary-fg' : 'border border-border text-fg',
                                  tone.c && !tone.solid && tone.c,
                                )}
                              >
                                {tone.btn}
                              </button>
                            </div>
                            <div className="mt-2 truncate text-[10.5px] text-fg-subtle">
                              {status === 'connecting' ? 'Établissement de la connexion…' : it.note}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </Card>

            <SiteParamsSection />
            <BrevoConfig />
            <EnedisConfig />
            <GrdfConfig />

            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
              <SectionCard
                title="Rôles & permissions"
                subtitle="Matrice RBAC · cloisonnement par périmètre (réseau / site / machine)"
              >
                <div className="overflow-x-auto">
                  <div className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] gap-1 border-b border-border px-[18px] py-2.5">
                    <div />
                    {d.rbac.roles.map((r) => (
                      <div key={r.key} className="text-center text-[10.5px] font-bold leading-[1.2] text-fg-muted">
                        {r.label}
                      </div>
                    ))}
                  </div>
                  {d.rbac.rows.map((row) => (
                    <div key={row.permissionKey} className="grid min-w-[520px] grid-cols-[1.6fr_repeat(5,minmax(64px,1fr))] items-center gap-1 border-b border-border px-[18px] py-[9px] last:border-b-0">
                      <div className="truncate text-xs font-medium">{row.label}</div>
                      {row.allowed.map((ok, i) => (
                        <div key={i} className="flex items-center justify-center">
                          {ok ? (
                            <Icon name="check" size={16} className="text-ok" strokeWidth={2.4} />
                          ) : (
                            <span className="h-[2px] w-3 rounded bg-border-strong" />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Journal d'audit">
                {d.audit.map((ev) => (
                  <div key={ev.id} className="flex gap-[11px] border-b border-border px-[18px] py-3 last:border-b-0">
                    <span className="w-[38px] flex-shrink-0 font-mono text-[11px] text-fg-subtle">
                      {new Date(ev.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1 text-[12.5px] leading-[1.4]">
                      <span className="font-semibold">{ev.userLabel}</span> <span className="text-fg-muted">{ev.action}</span>
                      <div className="mt-px text-[11px] text-fg-subtle">{ev.entityLabel}</div>
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

/** Field-level state shared by both connector wizards. */
function fieldCls(extra?: string) {
  return cn(
    'h-[38px] min-w-[220px] rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary',
    extra,
  );
}

function SiteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { sites } = useScope();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-fg-subtle">Site</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls()}>
        <option value="">Choisir un site…</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Numbered step rail, e.g. Saisie › Consentement › Historique. */
function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
      {labels.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
              i < current
                ? 'bg-ok text-white'
                : i === current
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface-3 text-fg-subtle',
            )}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={cn(i === current ? 'font-semibold text-fg' : 'text-fg-subtle')}>{l}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
        </span>
      ))}
    </div>
  );
}

/** Sparkline + totals for the first slice of history a connector pulled in. */
function HistoryPreview({ history }: { history: ConnectorHistory }) {
  const pts = history.points;
  const max = Math.max(1, ...pts.map((p) => p.kwh));
  const W = 260;
  const H = 40;
  const path = pts
    .map((p, i) => `${(i / Math.max(1, pts.length - 1)) * W},${(H - (p.kwh / max) * H).toFixed(1)}`)
    .join(' ');
  const avg = pts.length ? history.total / pts.length : 0;
  const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return (
    <div className="rounded-[10px] border border-border bg-surface-2 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ok">
          <Icon name="check" size={14} strokeWidth={2.4} />
          Premier historique importé
        </span>
        {history.simulated && (
          <span className="rounded-[6px] bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
            Simulation
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mb-2 h-10 w-full text-primary" aria-hidden>
        <polyline points={path} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-fg-muted">
        <span>
          <strong className="text-fg">{num(history.total)}</strong> {history.unit} · {pts.length} j
        </span>
        <span>
          Moy. <strong className="text-fg">{avg.toFixed(1)}</strong> {history.unit}/j
        </span>
        <span className="font-mono text-fg-subtle">
          {history.from} → {history.to}
        </span>
        <span className="font-mono text-fg-subtle">#{history.usagePointId}</span>
      </div>
    </div>
  );
}

type MeterKind = EnedisMeterKind;
type EnedisMode = 'prm' | 'address';

/**
 * M5 — Enedis Data Connect onboarding wizard. Full consent flow per site:
 *   saisie (PRM/PDL number or address) + confirmation → demande de consentement
 *   (redirection Data Connect) → import du premier historique (30 j) qui alimente
 *   les écrans Énergie/OPERAT. Runs against the mock client offline (simulated
 *   consent) and against the NestJS backend when wired.
 */
function EnedisConfig() {
  const api = useApi();
  const { sites } = useScope();
  const { toast } = useToast();

  const [kind, setKind] = useState<MeterKind>('pdl');
  const [mode, setMode] = useState<EnedisMode>('prm');
  const [siteId, setSiteId] = useState('');
  const [ref, setRef] = useState('');
  const [address, setAddress] = useState('');
  const [confirmed, setConfirmed] = useState<{ valid: boolean; label: string; message: string; prm: string | null } | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [history, setHistory] = useState<ConnectorHistory | null>(null);

  const validateM = useMutation({
    mutationFn: () => api.enedisValidate({ siteId, kind, mode, prm: ref, address }),
    onSuccess: (r) => setConfirmed(r),
  });
  const authorizeM = useMutation({
    mutationFn: () => api.enedisAuthorize({ siteId, kind, prm: confirmed?.prm ?? undefined, address }),
    onSuccess: (r) => {
      if (r.authorizeUrl.startsWith('http')) {
        // Real Enedis consent (or local sim callback): full redirect; we resume
        // via the ?enedis=…&state=… params on return (see effect below).
        window.location.href = r.authorizeUrl;
      } else {
        setAwaiting(true); // mock: drive the simulated consent in-app
        (window as unknown as { __enedisState?: string }).__enedisState = r.state;
      }
    },
  });
  const completeM = useMutation({
    mutationFn: (state: string) => api.enedisComplete({ state }),
    onSuccess: (r) => {
      setAwaiting(false);
      if (r.status === 'connected' && r.history) {
        setHistory(r.history);
        toast(r.message, 'ok');
      } else {
        toast(r.message, 'danger');
      }
    },
  });

  // Resume the flow when Enedis redirects the customer back to /settings.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('enedis');
    const state = params.get('state');
    if (!status) return;
    if (status === 'ok' && state) completeM.mutate(state);
    else if (status === 'error') toast('Le consentement Enedis a échoué ou a été refusé.', 'danger');
    params.delete('enedis');
    params.delete('state');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, []);

  // Editing the identifiers invalidates a prior confirmation.
  const reset = () => {
    setConfirmed(null);
    setAwaiting(false);
    setHistory(null);
  };

  const hasInput = mode === 'prm' ? ref.trim().length > 0 : address.trim().length > 0;
  const step = history ? 3 : awaiting ? 2 : confirmed?.valid ? 1 : 0;
  const site = sites.find((s) => s.id === siteId);

  return (
    <SectionCard
      className="mb-[18px]"
      title="Enedis · connexion d'un point de livraison"
      subtitle="Data Connect — saisie & confirmation, consentement, puis import du premier historique (Énergie & OPERAT)."
    >
      <div className="flex flex-col gap-4 p-[18px]">
        <div className="flex items-center gap-2 text-primary">
          <Icon name="bolt" size={16} strokeWidth={2} />
          <Steps current={step} labels={['Identifiant', 'Consentement', 'Historique']} />
        </div>

        {/* Step 0 — meter kind + input mode + fields */}
        <div className="flex flex-wrap gap-2">
          <Segmented
            ariaLabel="Type de compteur"
            value={kind}
            onChange={(k) => {
              setKind(k);
              reset();
            }}
            options={[
              { value: 'pdl', label: 'Linky · PDL/PRM' },
              { value: 'c4', label: 'Grand tertiaire · C4' },
            ]}
          />
          <Segmented
            ariaLabel="Mode de saisie"
            value={mode}
            onChange={(m) => {
              setMode(m);
              reset();
            }}
            options={[
              { value: 'prm', label: 'Par numéro' },
              { value: 'address', label: 'Par adresse' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SiteSelect
            value={siteId}
            onChange={(v) => {
              setSiteId(v);
              reset();
            }}
          />
          {mode === 'prm' ? (
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] font-semibold text-fg-subtle">
                {kind === 'pdl' ? 'Numéro de PDL / PRM (14 chiffres)' : 'Référence C4 (tarif jaune/vert)'}
              </span>
              <input
                value={ref}
                onChange={(e) => {
                  setRef(kind === 'pdl' ? digits14(e.target.value) : e.target.value);
                  reset();
                }}
                inputMode={kind === 'pdl' ? 'numeric' : 'text'}
                placeholder={kind === 'pdl' ? '12345678901234' : 'ex. GRD-C4-0098-XX'}
                className={fieldCls('flex-1 font-mono')}
              />
              {kind === 'pdl' && (
                <span className={cn('text-[10.5px]', ref.length === 14 ? 'text-ok' : 'text-fg-subtle')}>
                  {ref.length}/14 chiffres
                </span>
              )}
            </label>
          ) : (
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] font-semibold text-fg-subtle">Adresse du point de livraison</span>
              <AddressField
                value={address}
                onChange={(v) => {
                  setAddress(v);
                  reset();
                }}
                onSelect={() => reset()}
                className="flex-1"
              />
              <span className="text-[10.5px] text-fg-subtle">
                Recherche via l’API Adresse (data.gouv.fr) — le PDL est confirmé au consentement Enedis.
              </span>
            </label>
          )}
          <Button
            variant="secondary"
            onClick={() => validateM.mutate()}
            disabled={!siteId || !hasInput || validateM.isPending}
          >
            {validateM.isPending ? 'Vérification…' : 'Vérifier'}
          </Button>
        </div>

        {/* Field confirmation */}
        {confirmed && (
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-[10px] border p-3 text-[12.5px] leading-[1.5]',
              confirmed.valid ? 'border-ok bg-ok-soft text-ok' : 'border-danger bg-danger-soft text-danger',
            )}
          >
            <Icon name={confirmed.valid ? 'check' : 'alert'} size={15} className="mt-px flex-shrink-0" strokeWidth={2.2} />
            <div className="text-fg">
              {confirmed.valid && confirmed.label && <div className="font-semibold">{confirmed.label}</div>}
              <div className={cn('text-[12px]', confirmed.valid ? 'text-fg-muted' : 'text-danger')}>{confirmed.message}</div>
            </div>
          </div>
        )}

        {/* Step 1 — consent */}
        {step >= 1 && !history && (
          <div className="rounded-[10px] border border-border bg-surface-2 p-3.5">
            {!awaiting ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12.5px] text-fg-muted">
                  Prêt à demander le consentement <strong>Enedis Data Connect</strong> pour «&nbsp;{site?.name}&nbsp;».
                </span>
                <Button
                  variant="primary"
                  icon="power"
                  onClick={() => authorizeM.mutate()}
                  disabled={authorizeM.isPending}
                >
                  {authorizeM.isPending ? 'Redirection…' : 'Autoriser via Data Connect'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-[12.5px] font-semibold">Écran de consentement Enedis — simulation</div>
                <div className="text-[12px] leading-[1.55] text-fg-muted">
                  En production, le client est redirigé vers Enedis pour autoriser l'accès à ses données. Ici, validez
                  le consentement pour poursuivre.
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() =>
                      completeM.mutate((window as unknown as { __enedisState?: string }).__enedisState ?? '')
                    }
                    disabled={completeM.isPending}
                  >
                    {completeM.isPending ? 'Import en cours…' : "J'autorise l'accès à mes données"}
                  </Button>
                  <Button variant="secondary" onClick={reset}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — imported history */}
        {history && (
          <div className="flex flex-col gap-2">
            <HistoryPreview history={history} />
            <Button variant="secondary" onClick={reset} className="self-start">
              Connecter un autre point
            </Button>
          </div>
        )}

        <div className="flex gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3 text-[12px] leading-[1.55] text-fg-muted">
          <Icon name="info" size={15} className="mt-px flex-shrink-0 text-primary" strokeWidth={1.9} />
          <div>
            Où trouver le <strong>PDL / PRM</strong> ? Appuyez sur la touche <strong>+</strong> du compteur{' '}
            <strong>Linky</strong> jusqu'à l'écran « Numéro de PRM » — un identifiant à <strong>14 chiffres</strong>, aussi
            présent sur toute facture d'électricité. Aucune donnée n'est importée avant le consentement du client via{' '}
            <strong>Enedis Data Connect</strong>.
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * M5 — GRDF ADICT onboarding (gas). No per-customer consent redirect: the
 * aggregator authenticates with OAuth2 client_credentials (bac à sable), tests
 * the PCE, then pulls the first informative-consumption history.
 */
function GrdfConfig() {
  const api = useApi();
  const { sites } = useScope();
  const { toast } = useToast();

  const [siteId, setSiteId] = useState('');
  const [pce, setPce] = useState('');
  const [tested, setTested] = useState<{ ok: boolean; message: string; simulated: boolean } | null>(null);
  const [history, setHistory] = useState<ConnectorHistory | null>(null);

  const reset = () => {
    setTested(null);
    setHistory(null);
  };

  const testM = useMutation({
    mutationFn: () => api.grdfTest({ siteId, pce }),
    onSuccess: (r) => {
      setTested(r);
      toast(r.message, r.ok ? 'ok' : 'danger');
    },
  });
  const historyM = useMutation({
    mutationFn: () => api.grdfHistory({ siteId, pce }),
    onSuccess: (r) => {
      setHistory(r);
      toast(`Historique gaz importé — ${r.points.length} jours.`, 'ok');
    },
  });

  const site = sites.find((s) => s.id === siteId);
  const step = history ? 2 : tested?.ok ? 1 : 0;

  return (
    <SectionCard
      className="mb-[18px]"
      title="GRDF ADICT · connexion d'un PCE (gaz)"
      subtitle="Authentification client_credentials (bac à sable), test du PCE, puis import du premier historique de consommation."
    >
      <div className="flex flex-col gap-4 p-[18px]">
        <div className="flex items-center gap-2 text-[#e8663d]">
          <Icon name="flame" size={16} strokeWidth={2} />
          <Steps current={step} labels={['PCE', 'Connexion', 'Historique']} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SiteSelect
            value={siteId}
            onChange={(v) => {
              setSiteId(v);
              reset();
            }}
          />
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Numéro de PCE (14 chiffres)</span>
            <input
              value={pce}
              onChange={(e) => {
                setPce(digits14(e.target.value));
                reset();
              }}
              inputMode="numeric"
              placeholder="12345678901234"
              className={fieldCls('flex-1 font-mono')}
            />
            <span className={cn('text-[10.5px]', pce.length === 14 ? 'text-ok' : 'text-fg-subtle')}>
              {pce.length}/14 chiffres
            </span>
          </label>
          <Button
            variant="secondary"
            onClick={() => testM.mutate()}
            disabled={!siteId || !pce.trim() || testM.isPending}
          >
            {testM.isPending ? 'Test…' : 'Tester la connexion'}
          </Button>
        </div>

        {tested && (
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-[10px] border p-3 text-[12.5px] leading-[1.5]',
              tested.ok ? 'border-ok bg-ok-soft' : 'border-danger bg-danger-soft',
            )}
          >
            <Icon
              name={tested.ok ? 'check' : 'alert'}
              size={15}
              className={cn('mt-px flex-shrink-0', tested.ok ? 'text-ok' : 'text-danger')}
              strokeWidth={2.2}
            />
            <div className="text-fg">
              <span className={cn('font-semibold', tested.ok ? 'text-ok' : 'text-danger')}>
                {tested.ok ? 'GRDF ADICT connecté' : 'Connexion impossible'}
              </span>
              {tested.simulated && (
                <span className="ml-2 rounded-[6px] bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase text-fg-subtle">
                  Bac à sable
                </span>
              )}
              <div className="text-[12px] text-fg-muted">{tested.message}</div>
            </div>
          </div>
        )}

        {step >= 1 && !history && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 p-3.5">
            <span className="text-[12.5px] text-fg-muted">
              PCE reconnu pour «&nbsp;{site?.name}&nbsp;». Importez le premier historique pour alimenter l'écran Énergie.
            </span>
            <Button variant="primary" icon="download" onClick={() => historyM.mutate()} disabled={historyM.isPending}>
              {historyM.isPending ? 'Import en cours…' : "Importer l'historique"}
            </Button>
          </div>
        )}

        {history && (
          <div className="flex flex-col gap-2">
            <HistoryPreview history={history} />
            <Button variant="secondary" onClick={reset} className="self-start">
              Connecter un autre PCE
            </Button>
          </div>
        )}

        <div className="flex gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3 text-[12px] leading-[1.55] text-fg-muted">
          <Icon name="info" size={15} className="mt-px flex-shrink-0 text-primary" strokeWidth={1.9} />
          <div>
            Le <strong>PCE</strong> (Point de Comptage et d'Estimation) est l'identifiant à <strong>14 chiffres</strong> de
            votre compteur gaz, présent sur la facture GRDF. La connexion utilise l'API <strong>GRDF ADICT</strong> ; les
            identifiants du bac à sable sont préconfigurés côté serveur.
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * M12 — per-site parameters. An admin picks a site and edits its address (via the
 * gouv BAN autocomplete) and energy identifiers (PDL / PCE, 14 digits). Stored
 * client-side per site; a live build persists to core.site / connector_config.
 */
function SiteParamsSection() {
  const { sites } = useScope();
  const { toast } = useToast();
  const [params, setParams] = useAppParams();
  const [siteId, setSiteId] = useState('');
  const [draft, setDraft] = useState<SiteParams>(emptySiteParams());

  // Default to the first site once the list loads.
  useEffect(() => {
    if (!siteId && sites.length) setSiteId(sites[0]!.id);
  }, [sites, siteId]);

  // Load the selected site's saved params (falling back to its known address).
  useEffect(() => {
    if (!siteId) return;
    const stored = params.sites[siteId];
    const site = sites.find((s) => s.id === siteId);
    setDraft(stored ?? { ...emptySiteParams(), address: site?.address ?? '' });
  }, [siteId]);

  const pdlOk = draft.pdl === '' || draft.pdl.length === 14;
  const pceOk = draft.pce === '' || draft.pce.length === 14;

  const save = () => {
    if (!siteId) return;
    setParams({ sites: { [siteId]: draft } });
    toast(`Paramètres du site « ${sites.find((s) => s.id === siteId)?.name ?? ''} » enregistrés.`);
  };

  return (
    <SectionCard
      className="mb-[18px]"
      title="Paramètres par site"
      subtitle="Adresse et identifiants énergie (PDL / PCE) configurés site par site."
    >
      <div className="flex flex-col gap-4 p-[18px]">
        {/* Clean site picker (replaces the previous cramped dropdown). */}
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => {
            const active = s.id === siteId;
            const configured = !!params.sites[s.id]?.pdl || !!params.sites[s.id]?.pce;
            return (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-fg'
                    : 'border-border bg-surface text-fg-muted hover:border-border-strong',
                )}
              >
                {configured && <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : 'bg-ok')} />}
                {s.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[11px] font-semibold text-fg-subtle">Adresse du site</span>
            <AddressField value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">PDL / PRM Enedis (14 chiffres)</span>
            <input
              value={draft.pdl}
              onChange={(e) => setDraft((d) => ({ ...d, pdl: digits14(e.target.value) }))}
              inputMode="numeric"
              placeholder="12345678901234"
              className={fieldCls('font-mono')}
            />
            <span className={cn('text-[10.5px]', draft.pdl === '' ? 'text-fg-subtle' : pdlOk ? 'text-ok' : 'text-danger')}>
              {draft.pdl.length}/14 chiffres
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">PCE GRDF (14 chiffres)</span>
            <input
              value={draft.pce}
              onChange={(e) => setDraft((d) => ({ ...d, pce: digits14(e.target.value) }))}
              inputMode="numeric"
              placeholder="12345678901234"
              className={fieldCls('font-mono')}
            />
            <span className={cn('text-[10.5px]', draft.pce === '' ? 'text-fg-subtle' : pceOk ? 'text-ok' : 'text-danger')}>
              {draft.pce.length}/14 chiffres
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" icon="check" onClick={save} disabled={!siteId || !pdlOk || !pceOk}>
            Enregistrer le site
          </Button>
          <span className="text-[11.5px] text-fg-subtle">
            Adresse recherchée via l’API Adresse (data.gouv.fr). Le PDL est confirmé au consentement Enedis ci-dessous.
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * M12 — Brevo (messaging) self-service configuration. The admin sets the sender
 * identity and API key. The key itself is never stored client-side — only the
 * fact that one was provided (a live build writes it to Secrets Manager).
 */
function BrevoConfig() {
  const { toast } = useToast();
  const [params, setParams] = useAppParams();
  const b = params.brevo;
  const [enabled, setEnabled] = useState(b.enabled);
  const [senderName, setSenderName] = useState(b.senderName);
  const [senderEmail, setSenderEmail] = useState(b.senderEmail);
  const [apiKey, setApiKey] = useState('');

  const save = () => {
    setParams({
      brevo: {
        enabled,
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        keyConfigured: b.keyConfigured || apiKey.trim().length > 0,
      },
    });
    setApiKey('');
    toast('Configuration Brevo enregistrée.');
  };

  return (
    <SectionCard
      className="mb-[18px]"
      title="Brevo · messagerie (SMS / e-mail)"
      subtitle="Paramétrez l’expéditeur et la clé API utilisés pour les notifications clients."
    >
      <div className="flex flex-col gap-4 p-[18px]">
        <Switch checked={enabled} onChange={setEnabled} label="Activer l’envoi via Brevo" />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Nom de l’expéditeur</span>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="LavoPilot" className={fieldCls()} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">E-mail expéditeur</span>
            <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} type="email" placeholder="no-reply@laverie.fr" className={fieldCls()} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[11px] font-semibold text-fg-subtle">
              Clé API Brevo {b.keyConfigured && <span className="text-ok">· configurée ✓</span>}
            </span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder={b.keyConfigured ? '•••••••••• (laisser vide pour conserver)' : 'xkeysib-…'}
              className={fieldCls('font-mono')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" icon="check" onClick={save}>
            Enregistrer
          </Button>
          <span className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
            <Icon name="shield" size={13} className="text-fg-subtle" />
            La clé est transmise au coffre de secrets — jamais stockée en clair dans le navigateur.
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
