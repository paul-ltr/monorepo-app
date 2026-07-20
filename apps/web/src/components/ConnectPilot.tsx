import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ConnectorHistory } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/cn';

/** Keep only the leading 14 digits (Enedis PDL / GRDF PCE format). */
const digits14 = (s: string) => s.replace(/\D/g, '').slice(0, 14);

/**
 * Reusable connector onboarding — connect a PDL/PRM (Enedis, electricity) or a
 * PCE (GRDF, gas) in one compact widget. Mounted both inline in the LavoPilot
 * chat (from a `connect` card) and on the Connections page. Runs the full
 * happy-path against the API/mock and reports the first imported history.
 */
export function ConnectPilot({
  provider,
  siteId: siteIdProp,
  onConnected,
  className,
}: {
  provider: 'enedis' | 'grdf';
  siteId?: string;
  onConnected?: (history: ConnectorHistory) => void;
  className?: string;
}) {
  const api = useApi();
  const { sites, scope } = useScope();
  const initialSite = siteIdProp ?? (scope.type === 'site' ? scope.siteId : '');
  const [siteId, setSiteId] = useState(initialSite);
  const [ref, setRef] = useState('');
  const [history, setHistory] = useState<ConnectorHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGas = provider === 'grdf';
  const label = isGas
    ? 'Numéro de PCE (gaz · 14 chiffres)'
    : 'Numéro de PDL / PRM (électricité · 14 chiffres)';

  const connect = useMutation({
    mutationFn: async (): Promise<ConnectorHistory> => {
      if (isGas) {
        const t = await api.grdfTest({ siteId, pce: ref });
        if (!t.ok) throw new Error(t.message);
        return api.grdfHistory({ siteId, pce: ref });
      }
      const v = await api.enedisValidate({ siteId, kind: 'pdl', mode: 'prm', prm: ref });
      if (!v.valid) throw new Error(v.message);
      const a = await api.enedisAuthorize({ siteId, kind: 'pdl', prm: v.prm ?? ref });
      if (a.authorizeUrl.startsWith('http')) {
        // Real consent redirect — leaves the app and resumes on /connections.
        window.location.href = a.authorizeUrl;
        return Promise.reject(new Error('redirect'));
      }
      const c = await api.enedisComplete({ state: a.state });
      if (c.status !== 'connected' || !c.history) throw new Error(c.message);
      return c.history;
    },
    onSuccess: (h) => {
      setHistory(h);
      setError(null);
      onConnected?.(h);
    },
    onError: (e) => setError(e instanceof Error && e.message !== 'redirect' ? e.message : null),
  });

  const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  if (history) {
    return (
      <div className={cn('rounded-[12px] border border-ok bg-ok-soft/40 p-3.5', className)}>
        <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ok">
          <Icon name="check" size={15} strokeWidth={2.4} />
          {isGas ? 'Compteur gaz connecté' : 'Compteur électrique connecté'}
        </div>
        <div className="text-[12px] text-fg-muted">
          {history.points.length} jours importés ·{' '}
          <strong className="text-fg">{num(history.total)}</strong> {history.unit} ·{' '}
          <span className="font-mono text-fg-subtle">#{history.usagePointId}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-[12px] border border-border bg-surface p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[12.5px] font-semibold">
        <Icon
          name={isGas ? 'flame' : 'bolt'}
          size={15}
          className={isGas ? 'text-danger' : 'text-warn'}
          strokeWidth={2}
        />
        {isGas ? 'Connecter un PCE (GRDF ADICT)' : 'Connecter un PDL/PRM (Enedis)'}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-fg-subtle">Site</span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="h-[36px] rounded-[9px] border border-border bg-surface-2 px-2.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="">Choisir un site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-fg-subtle">{label}</span>
        <input
          value={ref}
          onChange={(e) => {
            setRef(digits14(e.target.value));
            setError(null);
          }}
          inputMode="numeric"
          placeholder="12345678901234"
          className="h-[36px] rounded-[9px] border border-border bg-surface-2 px-2.5 font-mono text-[13px] outline-none focus:border-primary"
        />
        <span className={cn('text-[10.5px]', ref.length === 14 ? 'text-ok' : 'text-fg-subtle')}>
          {ref.length}/14 chiffres
        </span>
      </label>
      {error && (
        <div className="flex items-center gap-1.5 rounded-[8px] bg-danger-soft px-2.5 py-1.5 text-[11.5px] font-medium text-danger">
          <Icon name="alert" size={13} strokeWidth={2} />
          {error}
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        icon="power"
        disabled={!siteId || ref.length !== 14 || connect.isPending}
        onClick={() => connect.mutate()}
        className="self-start"
      >
        {connect.isPending ? 'Connexion…' : 'Connecter'}
      </Button>
      <p className="text-[10.5px] leading-snug text-fg-subtle">
        Aucune donnée n’est importée avant votre consentement. Le numéro figure sur votre facture{' '}
        {isGas ? 'gaz (GRDF)' : "d'électricité"}.
      </p>
    </div>
  );
}
