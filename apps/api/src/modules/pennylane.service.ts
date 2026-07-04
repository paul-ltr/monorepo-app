import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type PennylaneCompleteResult,
  type PennylaneStatus,
  PENNYLANE_TOKEN_URL,
  PENNYLANE_REVOKE_URL,
  buildPennylaneAuthorizeUrl,
} from '@pilotage/shared';
import { loadEnv } from '@/config/env';

interface PendingConsent {
  tenantId: string;
  createdAt: number;
}
interface Connection {
  company: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

const CONSENT_TTL_MS = 15 * 60 * 1000;

/**
 * M6 — Pennylane accounting connector (OAuth 2.0 authorization-code flow).
 *
 *   authorize (build consent URL) → [user consents on Pennylane] →
 *   callback (exchange code for tokens) → complete (drain outcome) → status.
 *
 * When PENNYLANE_CLIENT_ID is unset (local/dev) the flow is *simulated*: the
 * authorize URL bounces straight back to our callback with a self-issued code
 * and no live token exchange happens — mirrors EnedisService. Tokens are kept
 * in memory per tenant (a production build would persist an encrypted refresh
 * token via Secrets Manager, per ARCHITECTURE §connectors).
 */
@Injectable()
export class PennylaneService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(PennylaneService.name);
  private readonly pending = new Map<string, PendingConsent>();
  private readonly connections = new Map<string, Connection>();

  get configured(): boolean {
    return !!this.env.PENNYLANE_CLIENT_ID && !!this.env.PENNYLANE_CLIENT_SECRET;
  }

  private redirectUri(): string {
    return `${this.env.API_PUBLIC_URL}/connectors/pennylane/callback`;
  }

  status(tenantId: string): PennylaneStatus {
    const conn = this.connections.get(tenantId);
    return {
      connected: !!conn,
      company: conn?.company ?? null,
      simulated: !this.configured,
      expiresAt: conn ? new Date(conn.expiresAt).toISOString() : null,
    };
  }

  /** Step 1 — build the OAuth authorize URL (or the simulated self-callback). */
  authorize(tenantId: string) {
    const state = randomUUID();
    this.sweep();
    this.pending.set(state, { tenantId, createdAt: Date.now() });

    if (!this.configured) {
      this.logger.warn('PENNYLANE_CLIENT_ID unset — using simulated OAuth consent.');
      const authorizeUrl = `${this.redirectUri()}?code=SANDBOX-${state}&state=${state}`;
      return { authorizeUrl, state, simulated: true };
    }
    const authorizeUrl = buildPennylaneAuthorizeUrl({
      clientId: this.env.PENNYLANE_CLIENT_ID!,
      redirectUri: this.redirectUri(),
      state,
      scope: this.env.PENNYLANE_SCOPE,
    });
    return { authorizeUrl, state, simulated: false };
  }

  /** Callback / complete — exchange the code and store the connection. */
  async complete(tenantId: string, state: string, code?: string): Promise<PennylaneCompleteResult> {
    const consent = this.pending.get(state);
    if (!consent || consent.tenantId !== tenantId) {
      return {
        status: 'error',
        company: null,
        message: 'Consentement introuvable ou expiré. Relancez la connexion.',
        simulated: !this.configured,
        expiresAt: null,
      };
    }
    this.pending.delete(state);

    if (!this.configured) {
      const expiresAt = Date.now() + 86400 * 1000;
      this.connections.set(tenantId, {
        company: 'Société (bac à sable)',
        accessToken: `sandbox-${state}`,
        refreshToken: null,
        expiresAt,
      });
      return {
        status: 'connected',
        company: 'Société (bac à sable)',
        message: 'Pennylane connecté (simulation — aucun client OAuth configuré).',
        simulated: true,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    }

    // Live mode: an authorization code is mandatory. Its absence means the user
    // denied consent or Pennylane redirected with an error — never a success.
    if (!code) {
      return {
        status: 'error',
        company: null,
        message: 'Autorisation Pennylane refusée ou code manquant.',
        simulated: false,
        expiresAt: null,
      };
    }

    try {
      const tokens = await this.exchangeToken(code);
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      const company = await this.fetchCompanyName(tokens.accessToken);
      this.connections.set(tenantId, {
        company,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      });
      return {
        status: 'connected',
        company,
        message: 'Connexion Pennylane établie.',
        simulated: false,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    } catch (err) {
      this.logger.error(`Pennylane token exchange failed: ${(err as Error).message}`);
      return {
        status: 'error',
        company: null,
        message: 'Échec de l’échange de jeton Pennylane. Vérifiez la configuration.',
        simulated: false,
        expiresAt: null,
      };
    }
  }

  /** PUBLIC callback path — resolve the tenant from the state, then complete. */
  async completeFromCallback(state: string, code?: string): Promise<{ ok: boolean }> {
    const consent = this.pending.get(state);
    if (!consent) return { ok: false };
    const result = await this.complete(consent.tenantId, state, code);
    return { ok: result.status === 'connected' };
  }

  async disconnect(tenantId: string): Promise<PennylaneStatus> {
    const conn = this.connections.get(tenantId);
    // Best-effort token revocation at Pennylane for live connections.
    if (this.configured && conn && !conn.accessToken.startsWith('sandbox-')) {
      try {
        await fetch(PENNYLANE_REVOKE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: this.env.PENNYLANE_CLIENT_ID!,
            client_secret: this.env.PENNYLANE_CLIENT_SECRET!,
            token: conn.accessToken,
          }),
        });
      } catch (err) {
        this.logger.warn(`Pennylane token revoke failed: ${(err as Error).message}`);
      }
    }
    this.connections.delete(tenantId);
    return this.status(tenantId);
  }

  // ── Pennylane HTTP (only reached when `configured`) ───────────────────────

  private async exchangeToken(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
    const res = await fetch(PENNYLANE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.env.PENNYLANE_CLIENT_ID!,
        client_secret: this.env.PENNYLANE_CLIENT_SECRET!,
        code,
        redirect_uri: this.redirectUri(),
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) throw new Error('no access_token');
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresIn: json.expires_in ?? 86400,
    };
  }

  private async fetchCompanyName(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://app.pennylane.com/api/external/v2/me', {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { company?: { name?: string }; name?: string };
      return json.company?.name ?? json.name ?? null;
    } catch {
      return null;
    }
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.createdAt > CONSENT_TTL_MS) this.pending.delete(k);
  }
}
