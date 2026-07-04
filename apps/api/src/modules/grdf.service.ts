import { Injectable, Logger } from '@nestjs/common';
import {
  type ConnectorHistory,
  type GrdfTestResult,
  buildDailyHistory,
  cleanDigits,
  lastNDays,
} from '@pilotage/shared';
import { loadEnv } from '@/config/env';

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * M5 — GRDF ADICT (gas). Unlike Enedis there is no per-customer consent redirect
 * for the sandbox: the aggregator authenticates with OAuth2 `client_credentials`
 * and reads a PCE it has rights over. Sandbox (bac à sable) credentials ship as
 * env defaults, so `test` and `history` hit the live sandbox out of the box;
 * any network/credential failure degrades gracefully to a synthetic history.
 */
@Injectable()
export class GrdfService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(GrdfService.name);
  private cached: CachedToken | null = null;

  /** OAuth2 client_credentials token, cached until ~1 min before expiry. */
  private async getToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.token;

    const url = new URL(this.env.GRDF_ADICT_TOKEN_URL);
    url.searchParams.set('grant_type', 'client_credentials');
    url.searchParams.set('scope', '/adict/v2');
    url.searchParams.set('client_id', this.env.GRDF_ADICT_CLIENT_ID);
    url.searchParams.set('client_secret', this.env.GRDF_ADICT_CLIENT_SECRET);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) throw new Error(`GRDF token ${res.status}: ${await res.text().catch(() => '')}`);
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error('GRDF token: no access_token');
    this.cached = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
    };
    return this.cached.token;
  }

  /** Step 1 — confirm the credentials work and the PCE is well-formed. */
  async test(pce: string): Promise<GrdfTestResult> {
    const clean = cleanDigits(pce);
    if (!/^\d{14}$/.test(clean)) {
      return {
        ok: false,
        pce: clean,
        tokenObtained: false,
        message: 'Le PCE doit comporter 14 chiffres.',
        simulated: false,
      };
    }
    try {
      const token = await this.getToken();
      // Probe the PCE's contractual data — a lightweight rights check.
      const res = await fetch(
        `${this.env.GRDF_ADICT_BASE_URL}/pce/${clean}/donnees_contractuelles`,
        { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
      );
      const reachable = res.ok || res.status === 403 || res.status === 404;
      return {
        ok: res.ok,
        pce: clean,
        tokenObtained: true,
        message: res.ok
          ? 'Connexion GRDF ADICT établie — PCE reconnu.'
          : res.status === 403
            ? 'Jeton valide mais ce PCE n’est pas dans votre périmètre de droits.'
            : res.status === 404
              ? 'Jeton valide mais PCE introuvable dans le bac à sable.'
              : `Réponse inattendue de GRDF ADICT (${res.status}).`,
        simulated: !reachable,
      };
    } catch (err) {
      this.logger.warn(`GRDF test fell back to simulation: ${(err as Error).message}`);
      return {
        ok: true,
        pce: clean,
        tokenObtained: false,
        message: 'Bac à sable GRDF injoignable — connexion simulée pour la démo.',
        simulated: true,
      };
    }
  }

  /** Step 2 — retrieve the first slice of informative daily consumption. */
  async history(pce: string): Promise<ConnectorHistory> {
    const clean = cleanDigits(pce);
    const { from, to } = lastNDays(30);
    try {
      const token = await this.getToken();
      const url =
        `${this.env.GRDF_ADICT_BASE_URL}/pce/${clean}/donnees_consos_informatives` +
        `?date_debut=${from}&date_fin=${to}`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`donnees_consos_informatives ${res.status}`);
      const json = (await res.json()) as GrdfConsoResponse;
      const parsed = parseGrdfHistory(clean, json, from, to);
      if (parsed.points.length > 0) return { ...parsed, simulated: false };
      throw new Error('empty consumption payload');
    } catch (err) {
      this.logger.warn(`GRDF history fell back to simulation: ${(err as Error).message}`);
      return { ...buildDailyHistory('grdf', clean, from, to, 42, 12), simulated: true };
    }
  }
}

/** ADICT returns an array of PCE blocks, each with a list of daily measures. */
type GrdfConsoResponse = Array<{
  pce?: { id_pce?: string };
  releve_debut?: string;
  releve_fin?: string;
  consommation?: {
    date_debut_consommation?: string;
    energie?: number; // kWh
  }[];
}>;

function parseGrdfHistory(
  pce: string,
  json: GrdfConsoResponse,
  from: string,
  to: string,
): Omit<ConnectorHistory, 'simulated'> {
  const block = Array.isArray(json) ? json[0] : undefined;
  const points = (block?.consommation ?? [])
    .filter((c) => c.date_debut_consommation && typeof c.energie === 'number')
    .map((c) => ({ date: c.date_debut_consommation!.slice(0, 10), kwh: Number(c.energie) }));
  const total = Math.round(points.reduce((s, p) => s + p.kwh, 0) * 100) / 100;
  return { provider: 'grdf', usagePointId: pce, unit: 'kWh', from, to, total, points };
}
