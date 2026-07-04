import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type ConnectorHistory,
  type EnedisAuthorizeInput,
  type EnedisValidateInput,
  type EnedisValidateResult,
  buildDailyHistory,
  cleanDigits,
  isValidEnedisRef,
  lastNDays,
  simulatedPrm,
} from '@pilotage/shared';
import { loadEnv } from '@/config/env';

/** Transient OAuth state carried across the consent redirect. */
interface PendingConsent {
  tenantId: string;
  siteId: string;
  prm: string | null;
  createdAt: number;
}

/** Result cached by the (public) callback, drained by the authed /complete. */
interface ConsentOutcome {
  tenantId: string;
  siteId: string;
  usagePointId: string;
  history: ConnectorHistory;
}

const CONSENT_TTL_MS = 15 * 60 * 1000;

/**
 * M5 — Enedis Data Connect (electricity). Implements the consent-redirect flow:
 *
 *   validate → authorize (build consent URL) → [customer consents on Enedis] →
 *   callback (exchange code, fetch first history) → complete (drain result).
 *
 * When ENEDIS_CLIENT_ID is unset (local/dev) the whole flow is *simulated*: the
 * authorize URL points back at our own callback with a self-issued code and the
 * first history is synthesised — so the wizard is exercisable end-to-end without
 * a registered Enedis client. Mirrors the MailerService graceful-fallback style.
 */
@Injectable()
export class EnedisService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(EnedisService.name);
  private readonly pending = new Map<string, PendingConsent>();
  private readonly outcomes = new Map<string, ConsentOutcome>();

  get configured(): boolean {
    return !!this.env.ENEDIS_CLIENT_ID && !!this.env.ENEDIS_CLIENT_SECRET;
  }

  /** Step 1 — confirm the PRM number or the postal address. */
  validate(input: EnedisValidateInput): EnedisValidateResult {
    if (input.mode === 'address') {
      const address = (input.address ?? '').replace(/\s+/g, ' ').trim();
      const valid = address.length >= 6;
      return {
        valid,
        prm: null,
        address: valid ? address : null,
        label: valid ? address : '',
        message: valid
          ? 'Adresse confirmée — le point de livraison sera identifié après consentement.'
          : 'Adresse trop courte pour être confirmée.',
      };
    }
    const prm = cleanDigits(input.prm ?? '');
    const valid = isValidEnedisRef(prm, input.kind);
    return {
      valid,
      prm: valid ? prm : null,
      address: null,
      label: valid ? `PRM ${prm.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}` : '',
      message: valid
        ? 'Numéro valide — prêt pour la demande de consentement Enedis.'
        : input.kind === 'pdl'
          ? 'Le PDL/PRM doit comporter exactement 14 chiffres.'
          : 'Référence C4 invalide (6 à 20 caractères).',
    };
  }

  /** Step 2 — build the Data Connect authorize URL and register the state. */
  authorize(tenantId: string, input: EnedisAuthorizeInput) {
    const state = randomUUID();
    const prm = input.prm ? cleanDigits(input.prm) : null;
    this.sweep();
    this.pending.set(state, { tenantId, siteId: input.siteId, prm, createdAt: Date.now() });

    const redirectUri = `${this.env.API_PUBLIC_URL}/connectors/enedis/callback`;

    if (!this.configured) {
      // Simulation: bounce straight to our own callback with a fake code.
      this.logger.warn('ENEDIS_CLIENT_ID unset — using simulated Data Connect consent.');
      const authorizeUrl = `${redirectUri}?code=SANDBOX-${state}&state=${state}`;
      return { authorizeUrl, state, simulated: true };
    }

    const url = new URL(this.env.ENEDIS_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.env.ENEDIS_CLIENT_ID!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('duration', 'P3Y'); // max consent horizon
    return { authorizeUrl: url.toString(), state, simulated: false };
  }

  /**
   * Step 3 (public callback) — exchange the code, fetch the first 30 days of
   * daily consumption, and cache the outcome for /complete to drain. Returns the
   * state so the controller can redirect the browser back to the web app.
   */
  async handleCallback(code: string, state: string): Promise<{ ok: boolean; state: string }> {
    const consent = this.pending.get(state);
    if (!consent) {
      this.logger.warn(`Enedis callback with unknown/expired state ${state}`);
      return { ok: false, state };
    }
    this.pending.delete(state);

    try {
      const { from, to } = lastNDays(30);

      if (!this.configured) {
        const usagePointId = consent.prm ?? simulatedPrm(code);
        this.outcomes.set(state, {
          tenantId: consent.tenantId,
          siteId: consent.siteId,
          usagePointId,
          history: this.simulatedHistory(usagePointId, from, to),
        });
        return { ok: true, state };
      }

      // Data Connect: the token response carries the consented usage_points_id.
      const { accessToken, usagePointsId } = await this.exchangeToken(code);
      const usagePointId = consent.prm ?? usagePointsId ?? simulatedPrm(code);
      const history = await this.fetchDailyConsumption(usagePointId, accessToken, from, to);
      this.outcomes.set(state, {
        tenantId: consent.tenantId,
        siteId: consent.siteId,
        usagePointId,
        history,
      });
      return { ok: true, state };
    } catch (err) {
      this.logger.error(`Enedis callback failed: ${(err as Error).message}`);
      return { ok: false, state };
    }
  }

  /** Step 4 — the authed web app drains the cached outcome for this tenant. */
  complete(tenantId: string, state: string): ConsentOutcome | null {
    const outcome = this.outcomes.get(state);
    if (!outcome || outcome.tenantId !== tenantId) return null;
    this.outcomes.delete(state);
    return outcome;
  }

  // ── Enedis HTTP (only reached when `configured`) ──────────────────────────

  private async exchangeToken(code: string): Promise<{ accessToken: string; usagePointsId?: string }> {
    const res = await fetch(`${this.env.ENEDIS_BASE_URL}/oauth2/v3/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.env.ENEDIS_CLIENT_ID!,
        client_secret: this.env.ENEDIS_CLIENT_SECRET!,
        code,
        redirect_uri: `${this.env.API_PUBLIC_URL}/connectors/enedis/callback`,
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const json = (await res.json()) as { access_token?: string; usage_points_id?: string };
    if (!json.access_token) throw new Error('no access_token');
    return { accessToken: json.access_token, usagePointsId: json.usage_points_id };
  }

  private async fetchDailyConsumption(
    usagePointId: string,
    token: string,
    from: string,
    to: string,
  ): Promise<ConnectorHistory> {
    try {
      const url =
        `${this.env.ENEDIS_BASE_URL}/metering_data_dc/v5/daily_consumption` +
        `?usage_point_id=${encodeURIComponent(usagePointId)}&start=${from}&end=${to}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`daily_consumption ${res.status}`);
      const json = (await res.json()) as EnedisMeteringResponse;
      const points = (json.meter_reading?.interval_reading ?? []).map((r) => ({
        date: r.date,
        kwh: Number(r.value) / 1000, // Wh → kWh
      }));
      if (points.length === 0) throw new Error('empty metering payload');
      const total = Math.round(points.reduce((s, p) => s + p.kwh, 0) * 100) / 100;
      return { provider: 'enedis', usagePointId, unit: 'kWh', from, to, total, points, simulated: false };
    } catch (err) {
      this.logger.warn(`Enedis history fetch fell back to simulation: ${(err as Error).message}`);
      return this.simulatedHistory(usagePointId, from, to);
    }
  }

  private simulatedHistory(usagePointId: string, from: string, to: string): ConnectorHistory {
    return { ...buildDailyHistory('enedis', usagePointId, from, to, 18, 6), simulated: true };
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.createdAt > CONSENT_TTL_MS) this.pending.delete(k);
  }
}

interface EnedisMeteringResponse {
  meter_reading?: {
    usage_point_id?: string;
    interval_reading?: { date: string; value: string }[];
  };
}
