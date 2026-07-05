import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type BridgeAccount,
  type BridgeAuthorizeResult,
  type BridgeCompleteResult,
  type BridgeStatus,
  BRIDGE_ACCOUNTS_PATH,
  BRIDGE_AUTH_TOKEN_PATH,
  BRIDGE_CONNECT_SESSIONS_PATH,
  BRIDGE_USERS_PATH,
  bridgeHeaders,
} from '@pilotage/shared';
import { loadEnv } from '@/config/env';

interface PendingConsent {
  tenantId: string;
  createdAt: number;
}
interface Connection {
  bank: string | null;
  accounts: BridgeAccount[];
  accessToken: string;
  expiresAt: number;
}

const CONSENT_TTL_MS = 15 * 60 * 1000;
/** DSP2 bank-account consent is time-boxed; Bridge caps it at ~90 days. */
const CONSENT_VALID_MS = 90 * 86400 * 1000;

/**
 * M6 — Bridge by Bankin' open-banking connector (agrégation bancaire DSP2).
 *
 *   authorize (create hosted Connect session) → [customer picks bank + consents
 *   on Bridge] → callback (redirect back) → complete (pull accounts) → status.
 *
 * When BRIDGE_CLIENT_ID is unset (local/dev) the flow is *simulated*: the connect
 * URL bounces straight back to our callback with a self-issued state, no live
 * Bridge call happens, and a deterministic set of aggregated accounts is
 * synthesised — mirrors EnedisService / PennylaneService. A production build
 * would persist the per-user Bridge token via Secrets Manager, per
 * ARCHITECTURE §connectors.
 */
@Injectable()
export class BridgeService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(BridgeService.name);
  private readonly pending = new Map<string, PendingConsent>();
  private readonly connections = new Map<string, Connection>();

  get configured(): boolean {
    return !!this.env.BRIDGE_CLIENT_ID && !!this.env.BRIDGE_CLIENT_SECRET;
  }

  private callbackUrl(): string {
    return `${this.env.API_PUBLIC_URL}/connectors/bridge/callback`;
  }

  status(tenantId: string): BridgeStatus {
    const conn = this.connections.get(tenantId);
    return {
      connected: !!conn,
      bank: conn?.bank ?? null,
      accounts: conn?.accounts ?? [],
      simulated: !this.configured,
      expiresAt: conn ? new Date(conn.expiresAt).toISOString() : null,
    };
  }

  /** Step 1 — mint the hosted Bridge Connect session (or a simulated self-callback). */
  async authorize(tenantId: string): Promise<BridgeAuthorizeResult> {
    const state = randomUUID();
    this.sweep();
    this.pending.set(state, { tenantId, createdAt: Date.now() });

    if (!this.configured) {
      this.logger.warn('BRIDGE_CLIENT_ID unset — using simulated open-banking consent.');
      const connectUrl = `${this.callbackUrl()}?state=${state}&status=success`;
      return { connectUrl, state, simulated: true };
    }

    try {
      const connectUrl = await this.createConnectSession(tenantId, state);
      return { connectUrl, state, simulated: false };
    } catch (err) {
      this.logger.error(`Bridge connect-session failed: ${(err as Error).message}`);
      // Surface a still-usable (error) URL so the wizard returns cleanly.
      return { connectUrl: `${this.callbackUrl()}?state=${state}&status=error`, state, simulated: false };
    }
  }

  /** Callback / complete — pull the aggregated accounts and store the connection. */
  async complete(tenantId: string, state: string): Promise<BridgeCompleteResult> {
    const consent = this.pending.get(state);
    if (!consent || consent.tenantId !== tenantId) {
      return {
        status: 'error',
        bank: null,
        accounts: [],
        message: 'Consentement introuvable ou expiré. Relancez la connexion.',
        simulated: !this.configured,
        expiresAt: null,
      };
    }
    this.pending.delete(state);
    const expiresAt = Date.now() + CONSENT_VALID_MS;

    if (!this.configured) {
      const accounts = simulatedAccounts(tenantId);
      const bank = accounts[0]?.bank ?? null;
      this.connections.set(tenantId, { bank, accounts, accessToken: `sandbox-${state}`, expiresAt });
      return {
        status: 'connected',
        bank,
        accounts,
        message: 'Banque connectée (simulation — aucun client Bridge configuré).',
        simulated: true,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    }

    try {
      const accessToken = await this.userToken(tenantId);
      const accounts = await this.fetchAccounts(accessToken);
      const bank = accounts[0]?.bank ?? null;
      this.connections.set(tenantId, { bank, accounts, accessToken, expiresAt });
      return {
        status: 'connected',
        bank,
        accounts,
        message: `Banque connectée — ${accounts.length} compte(s) agrégé(s).`,
        simulated: false,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    } catch (err) {
      this.logger.error(`Bridge account fetch failed: ${(err as Error).message}`);
      return {
        status: 'error',
        bank: null,
        accounts: [],
        message: 'Échec de la récupération des comptes Bridge. Vérifiez la configuration.',
        simulated: false,
        expiresAt: null,
      };
    }
  }

  /** PUBLIC callback path — resolve the tenant from the state, then complete. */
  async completeFromCallback(state: string): Promise<{ ok: boolean }> {
    const consent = this.pending.get(state);
    if (!consent) return { ok: false };
    const result = await this.complete(consent.tenantId, state);
    return { ok: result.status === 'connected' };
  }

  disconnect(tenantId: string): BridgeStatus {
    this.connections.delete(tenantId);
    return this.status(tenantId);
  }

  // ── Bridge HTTP (only reached when `configured`) ──────────────────────────

  private headers(accessToken?: string): Record<string, string> {
    return bridgeHeaders({
      clientId: this.env.BRIDGE_CLIENT_ID!,
      clientSecret: this.env.BRIDGE_CLIENT_SECRET!,
      accessToken,
    });
  }

  /** Ensure a Bridge aggregation user exists for the tenant and return a token. */
  private async userToken(tenantId: string): Promise<string> {
    // Idempotent: a 409 (user already exists) is fine — we only need a token.
    await fetch(`${this.env.BRIDGE_BASE_URL}${BRIDGE_USERS_PATH}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ external_user_id: tenantId }),
    }).catch(() => undefined);

    const res = await fetch(`${this.env.BRIDGE_BASE_URL}${BRIDGE_AUTH_TOKEN_PATH}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ external_user_id: tenantId }),
    });
    if (!res.ok) throw new Error(`token ${res.status}`);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('no access_token');
    return json.access_token;
  }

  private async createConnectSession(tenantId: string, state: string): Promise<string> {
    const accessToken = await this.userToken(tenantId);
    const res = await fetch(`${this.env.BRIDGE_BASE_URL}${BRIDGE_CONNECT_SESSIONS_PATH}`, {
      method: 'POST',
      headers: this.headers(accessToken),
      body: JSON.stringify({
        // Bridge appends the session outcome; we key our pending map on `state`.
        callback_url: `${this.callbackUrl()}?state=${state}`,
        country_code: 'FR',
      }),
    });
    if (!res.ok) throw new Error(`connect-session ${res.status}`);
    const json = (await res.json()) as { url?: string };
    if (!json.url) throw new Error('no connect url');
    return json.url;
  }

  private async fetchAccounts(accessToken: string): Promise<BridgeAccount[]> {
    const res = await fetch(`${this.env.BRIDGE_BASE_URL}${BRIDGE_ACCOUNTS_PATH}`, {
      headers: this.headers(accessToken),
    });
    if (!res.ok) throw new Error(`accounts ${res.status}`);
    const json = (await res.json()) as {
      resources?: Array<{
        id?: number | string;
        name?: string;
        balance?: number;
        currency_code?: string;
        bank?: { name?: string };
      }>;
    };
    return (json.resources ?? []).map((a) => ({
      id: String(a.id ?? ''),
      name: a.name ?? 'Compte',
      bank: a.bank?.name ?? null,
      balance: a.balance ?? 0,
      currency: a.currency_code ?? 'EUR',
    }));
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.createdAt > CONSENT_TTL_MS) this.pending.delete(k);
  }
}

/**
 * Deterministic synthetic accounts seeded by the tenant id, so the simulated
 * consent always yields the same bank + balances — a professional current
 * account plus a livret, the typical laundromat operator setup.
 */
function simulatedAccounts(seed: string): BridgeAccount[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const banks = ['BNP Paribas', 'Crédit Agricole', 'Société Générale', 'Qonto', 'Banque Populaire'];
  const bank = banks[h % banks.length] ?? 'BNP Paribas';
  const current = 8000 + (h % 12000);
  const savings = 15000 + ((h >>> 3) % 40000);
  return [
    { id: `sim-${(h % 100000).toString().padStart(5, '0')}`, name: 'Compte courant pro', bank, balance: current, currency: 'EUR' },
    { id: `sim-${((h >>> 5) % 100000).toString().padStart(5, '0')}`, name: 'Livret pro', bank, balance: savings, currency: 'EUR' },
  ];
}
