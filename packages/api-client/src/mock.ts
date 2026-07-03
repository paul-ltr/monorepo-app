import {
  type ConnectedMeter,
  type ConnectorHistory,
  type EnergyProvider,
  type Period,
  applyConnectorHistories,
  buildDailyHistory,
  cleanDigits,
  isValidEnedisRef,
  lastNDays,
  simulatedPrm,
} from '@pilotage/shared';
import type { PilotageApi } from './types';
import * as f from './fixtures';

const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** In-browser mock implementing the full API from bundled fixtures. */
export function createMockClient(): PilotageApi {
  // Transient consent state for the simulated Enedis flow (state → prm + site).
  const enedisPending = new Map<string, { prm: string | null; siteId: string }>();
  // Connected meters, keyed by `${provider}:${siteId}`, feed the Énergie screen.
  const connected = new Map<string, ConnectedMeter>();

  const remember = (provider: EnergyProvider, siteId: string, history: ConnectorHistory) => {
    const site = f.sites.find((s) => s.id === siteId);
    connected.set(`${provider}:${siteId}`, {
      provider,
      siteId,
      siteName: site?.name ?? siteId,
      surfaceM2: site?.surfaceM2 ?? null,
      history,
    });
  };

  return {
    getSession: () => delay(f.session),
    getBranding: () => delay(f.branding),
    getDashboard: (_period: Period) => delay(f.dashboard),
    getMachineStatuses: () => delay(f.machineStatuses),
    getMachineDetail: (id: string) => delay(f.machineDetail(id)),
    getRevenue: (_period: Period) => delay(f.revenue),
    getEnergy: () => delay(applyConnectorHistories(f.energy, [...connected.values()])),
    generateOperat: (year: number) =>
      delay({
        id: '00000000-0000-7000-8000-0000000000ff',
        year,
        status: 'ready' as const,
        siteCount: 6,
        fileKey: `operat/${year}/dossier.pdf`,
        createdAt: '2026-06-29T08:00:00.000Z',
      }),
    getMaintenance: () => delay(f.maintenance),
    getPricing: () => delay(f.pricing),
    getCustomers: () => delay(f.customers),
    getFinance: () => delay(f.finance),
    getNetwork: () => delay(f.network),
    getAdmin: () => delay(f.admin),
    getNotifications: () => delay(f.notifications),
    getSites: () => delay(f.sites),

    enedisValidate: (input) => {
      if (input.mode === 'address') {
        const address = (input.address ?? '').replace(/\s+/g, ' ').trim();
        const valid = address.length >= 6;
        return delay({
          valid,
          prm: null,
          address: valid ? address : null,
          label: valid ? address : '',
          message: valid
            ? 'Adresse confirmée — le point de livraison sera identifié après consentement.'
            : 'Adresse trop courte pour être confirmée.',
        });
      }
      const prm = cleanDigits(input.prm ?? '');
      const valid = isValidEnedisRef(prm, input.kind);
      return delay({
        valid,
        prm: valid ? prm : null,
        address: null,
        label: valid ? `PRM ${prm.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}` : '',
        message: valid
          ? 'Numéro valide — prêt pour la demande de consentement Enedis.'
          : input.kind === 'pdl'
            ? 'Le PDL/PRM doit comporter exactement 14 chiffres.'
            : 'Référence C4 invalide (6 à 20 caractères).',
      });
    },
    enedisAuthorize: (input) => {
      const state = `mock-${Math.random().toString(36).slice(2, 10)}`;
      enedisPending.set(state, { prm: input.prm ? cleanDigits(input.prm) : null, siteId: input.siteId });
      // No live Enedis in mock mode → the wizard drives the simulated consent.
      return delay({ authorizeUrl: `#enedis-consent/${state}`, state, simulated: true });
    },
    enedisComplete: (input) => {
      const pending = enedisPending.get(input.state);
      if (!pending) {
        return delay({
          status: 'error' as const,
          usagePointId: '',
          message: 'Consentement introuvable ou expiré. Relancez la connexion.',
          history: null,
        });
      }
      enedisPending.delete(input.state);
      const usagePointId = pending.prm ?? simulatedPrm(input.state);
      const { from, to } = lastNDays(30);
      const history = { ...buildDailyHistory('enedis', usagePointId, from, to, 18, 6), simulated: true };
      remember('enedis', pending.siteId, history);
      return delay({
        status: 'connected' as const,
        usagePointId,
        message: `Connexion Enedis établie — ${history.points.length} jours importés.`,
        history,
      });
    },
    grdfTest: (input) => {
      const pce = cleanDigits(input.pce);
      const ok = /^\d{14}$/.test(pce);
      return delay({
        ok,
        pce,
        tokenObtained: ok,
        message: ok
          ? 'Connexion GRDF ADICT établie — PCE reconnu (bac à sable).'
          : 'Le PCE doit comporter 14 chiffres.',
        simulated: true,
      });
    },
    grdfHistory: (input) => {
      const pce = cleanDigits(input.pce);
      const { from, to } = lastNDays(30);
      const history = { ...buildDailyHistory('grdf', pce, from, to, 42, 12), simulated: true };
      remember('grdf', input.siteId, history);
      return delay(history);
    },
  };
}
