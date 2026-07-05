import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import {
  type MieleAppliance,
  type MieleAccount,
  type MieleAssociateInput,
  type MieleAuthorizeInput,
  type MieleAuthorizeResult,
  type MieleCompleteResult,
  type MieleStatus,
  type RequestContext,
  buildMieleAuthorizeUrl,
  mapMieleType,
  mieleDevicesUrl,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { loadEnv } from '@/config/env';
import { AuditService } from './audit.service';
import { SecretStore } from './secret-store.service';

/** Transient OAuth state carried across the consent redirect. */
interface PendingConsent {
  tenantId: string;
  vg: string;
  label?: string;
  createdAt: number;
}

/** Result cached by the (public) callback, drained by the authed /complete. */
interface ConnectOutcome {
  tenantId: string;
  accountId: string;
  label: string;
  vg: string;
  refreshToken: string | null;
  appliances: MieleAppliance[];
  simulated: boolean;
}

/** A live (or simulated) connection to one Miele account. */
interface Connection {
  id: string;
  label: string;
  vg: string;
  refreshToken: string | null;
  simulated: boolean;
  connectedAt: string;
  secretRef: string;
  appliances: MieleAppliance[];
}

const CONSENT_TTL_MS = 15 * 60 * 1000;

/**
 * M1/M12 — Miele 3rd Party API connector (OAuth 2.0 authorization-code). Connects
 * a Miele@home account, lists its appliances, and lets each be associated with a
 * shop (site) — which materialises a `core.machine` row (brand `miele`) so it
 * flows into supervision and is visible to the data repo via `core.v_machine`.
 *
 *   authorize (build consent URL) → [user consents on Miele] →
 *   callback (exchange code, fetch devices, cache outcome) → complete (drain,
 *   store connection, persist) → status. The one public route is the callback
 *   (excluded from AuthMiddleware); it only caches the outcome, which the authed
 *   /complete drains under the tenant's RLS context.
 *
 * When MIELE_CLIENT_ID is unset the flow is *simulated* (self-issued code, demo
 * appliances) so the wizard is exercisable end-to-end — mirroring EnedisService.
 * Several accounts can be connected per tenant. Connections are kept in memory
 * (MVP); the durable record is `core.connector_config` + the refresh token stored
 * via SecretStore at `secret_ref`.
 */
@Injectable()
export class MieleService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(MieleService.name);
  private readonly pending = new Map<string, PendingConsent>();
  private readonly outcomes = new Map<string, ConnectOutcome>();
  /** tenantId → (accountId → connection). */
  private readonly byTenant = new Map<string, Map<string, Connection>>();

  constructor(
    private readonly db: ScopedDb,
    private readonly audit: AuditService,
    private readonly secrets: SecretStore,
  ) {}

  get configured(): boolean {
    return !!this.env.MIELE_CLIENT_ID && !!this.env.MIELE_CLIENT_SECRET;
  }

  private redirectUri(): string {
    return `${this.env.API_PUBLIC_URL}/connectors/miele/callback`;
  }

  private accounts(tenantId: string): Map<string, Connection> {
    const existing = this.byTenant.get(tenantId);
    if (existing) return existing;
    const fresh = new Map<string, Connection>();
    this.byTenant.set(tenantId, fresh);
    return fresh;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  status(tenantId: string): MieleStatus {
    const conns = [...this.accounts(tenantId).values()];
    return {
      accounts: conns.map((c) => this.toAccount(c)),
      appliances: conns.flatMap((c) => c.appliances),
      simulated: !this.configured,
    };
  }

  /** Step 1 — build the Miele consent URL (or the simulated self-callback). */
  authorize(tenantId: string, input: MieleAuthorizeInput): MieleAuthorizeResult {
    const state = randomUUID();
    this.sweep();
    this.pending.set(state, { tenantId, vg: input.vg, label: input.label, createdAt: Date.now() });

    if (!this.configured) {
      this.logger.warn('MIELE_CLIENT_ID unset — using simulated OAuth consent.');
      const authorizeUrl = `${this.redirectUri()}?code=SANDBOX-${state}&state=${state}`;
      return { authorizeUrl, state, simulated: true };
    }
    const authorizeUrl = buildMieleAuthorizeUrl({
      authorizeUrl: this.env.MIELE_AUTHORIZE_URL,
      clientId: this.env.MIELE_CLIENT_ID!,
      redirectUri: this.redirectUri(),
      state,
      vg: input.vg,
    });
    return { authorizeUrl, state, simulated: false };
  }

  /**
   * Step 2 (public callback) — exchange the code, fetch devices, and cache the
   * outcome for /complete to drain. Returns the state so the controller can
   * redirect the browser back to the web app.
   */
  async handleCallback(code: string, state: string): Promise<{ ok: boolean; state: string }> {
    const consent = this.pending.get(state);
    if (!consent) {
      this.logger.warn(`Miele callback with unknown/expired state ${state}`);
      return { ok: false, state };
    }
    this.pending.delete(state);
    const accountId = randomUUID();
    const label = consent.label?.trim() || `Compte Miele ${consent.vg}`;

    try {
      if (!this.configured || !code || code.startsWith('SANDBOX-')) {
        this.outcomes.set(state, {
          tenantId: consent.tenantId,
          accountId,
          label,
          vg: consent.vg,
          refreshToken: `sandbox-${accountId}`,
          appliances: this.demoAppliances(accountId),
          simulated: true,
        });
        return { ok: true, state };
      }

      const tokens = await this.exchangeToken(code);
      const appliances = await this.fetchDevices(tokens.accessToken, accountId);
      this.outcomes.set(state, {
        tenantId: consent.tenantId,
        accountId,
        label,
        vg: consent.vg,
        refreshToken: tokens.refreshToken,
        appliances,
        simulated: false,
      });
      return { ok: true, state };
    } catch (err) {
      this.logger.error(`Miele callback failed: ${(err as Error).message}`);
      return { ok: false, state };
    }
  }

  /** Step 3 — the authed web app drains the cached outcome and persists it. */
  async complete(tenantId: string, state: string): Promise<MieleCompleteResult> {
    const outcome = this.outcomes.get(state);
    if (!outcome || outcome.tenantId !== tenantId) {
      return {
        status: 'error',
        account: null,
        appliances: [],
        message: 'Consentement introuvable ou expiré. Relancez la connexion.',
        simulated: !this.configured,
      };
    }
    this.outcomes.delete(state);

    const secretRef = this.secrets.ref({
      provider: 'miele',
      tenantId,
      key: outcome.accountId,
    });
    if (outcome.refreshToken) await this.secrets.put(secretRef, outcome.refreshToken);

    const conn: Connection = {
      id: outcome.accountId,
      label: outcome.label,
      vg: outcome.vg,
      refreshToken: outcome.refreshToken,
      simulated: outcome.simulated,
      connectedAt: new Date().toISOString(),
      secretRef,
      appliances: outcome.appliances,
    };
    this.accounts(tenantId).set(conn.id, conn);
    await this.persistConfig(tenantId, conn);

    return {
      status: 'connected',
      account: this.toAccount(conn),
      appliances: conn.appliances,
      message: `Compte Miele connecté${outcome.simulated ? ' (simulation)' : ''} — ${conn.appliances.length} appareils.`,
      simulated: outcome.simulated,
    };
  }

  async associate(ctx: RequestContext, input: MieleAssociateInput): Promise<MieleStatus> {
    const conn = this.accounts(ctx.tenantId).get(input.accountId);
    const appliance = conn?.appliances.find((a) => a.applianceId === input.applianceId);
    if (!conn || !appliance) return this.status(ctx.tenantId);

    const machineId = await this.upsertMachine(ctx, appliance, input.siteId);
    appliance.siteId = input.siteId;
    appliance.machineId = machineId;
    appliance.siteName = null; // resolved client-side from the sites list
    return this.status(ctx.tenantId);
  }

  async disconnect(ctx: RequestContext, accountId: string): Promise<MieleStatus> {
    const conn = this.accounts(ctx.tenantId).get(accountId);
    if (conn) {
      await this.secrets.delete(conn.secretRef).catch(() => undefined);
      await this.markDisconnected(conn).catch(() => undefined);
      this.accounts(ctx.tenantId).delete(accountId);
      await this.audit
        .record(ctx, 'connector.miele.disconnected', 'connector_config', accountId)
        .catch(() => undefined);
    }
    return this.status(ctx.tenantId);
  }

  // ── Miele HTTP (only reached when `configured`) ─────────────────────────────

  private async exchangeToken(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
    const res = await fetch(this.env.MIELE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.env.MIELE_CLIENT_ID!,
        client_secret: this.env.MIELE_CLIENT_SECRET!,
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
      expiresIn: json.expires_in ?? 28_800,
    };
  }

  private async fetchDevices(accessToken: string, accountId: string): Promise<MieleAppliance[]> {
    const res = await fetch(mieleDevicesUrl(this.env.MIELE_API_BASE), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`devices ${res.status}`);
    // /v1/devices returns an object keyed by deviceId.
    const json = (await res.json()) as Record<string, MieleDevice>;
    return Object.entries(json).map(([deviceId, dev]) => {
      const ident = dev.ident ?? {};
      const label = ident.deviceIdentLabel ?? {};
      const rawStatus = dev.state?.status?.value_raw;
      return {
        applianceId: deviceId,
        name: ident.deviceName || ident.type?.value_localized || deviceId,
        type: ident.type?.value_localized ?? String(ident.type?.value_raw ?? 'Miele'),
        model: label.techType || null,
        serial: label.fabNumber || null,
        connected: rawStatus != null && rawStatus !== 255,
        accountId,
        siteId: null,
        siteName: null,
        machineId: null,
      } satisfies MieleAppliance;
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  /** Upsert a core.machine for an appliance and return its id (best-effort). */
  private async upsertMachine(
    ctx: RequestContext,
    appliance: MieleAppliance,
    siteId: string,
  ): Promise<string | null> {
    try {
      return await this.db.run(async (tx) => {
        const existing = (
          await tx
            .select()
            .from(schema.machine)
            .where(eq(schema.machine.externalRef, appliance.applianceId))
            .limit(1)
        )[0];
        const kind = mieleKindOf(appliance.type);
        const serial = appliance.serial ?? appliance.applianceId;
        if (existing) {
          await tx
            .update(schema.machine)
            .set({ siteId, kind, model: appliance.model, serial })
            .where(eq(schema.machine.id, existing.id));
          await this.audit.record(ctx, 'connector.miele.appliance_linked', 'machine', existing.id);
          return existing.id;
        }
        const inserted = (
          await tx
            .insert(schema.machine)
            .values({
              tenantId: ctx.tenantId,
              siteId,
              kind,
              brand: 'miele',
              model: appliance.model,
              serial,
              status: 'offline',
              externalRef: appliance.applianceId,
            })
            .returning({ id: schema.machine.id })
        )[0];
        if (inserted) {
          await this.audit.record(ctx, 'connector.miele.appliance_linked', 'machine', inserted.id);
        }
        return inserted?.id ?? null;
      });
    } catch (err) {
      this.logger.warn(`machine upsert skipped: ${(err as Error).message}`);
      return null;
    }
  }

  /** Upsert the connector_config row for this account (best-effort). */
  private async persistConfig(tenantId: string, conn: Connection): Promise<void> {
    const config = {
      accountId: conn.id,
      accountLabel: conn.label,
      vg: conn.vg,
      applianceIds: conn.appliances.map((a) => a.applianceId),
      applianceCount: conn.appliances.length,
      simulated: conn.simulated,
    };
    try {
      await this.db.run(async (tx) => {
        const existing = (
          await tx
            .select()
            .from(schema.connectorConfig)
            .where(
              and(
                eq(schema.connectorConfig.provider, 'miele'),
                eq(schema.connectorConfig.secretRef, conn.secretRef),
              ),
            )
            .limit(1)
        )[0];
        if (existing) {
          await tx
            .update(schema.connectorConfig)
            .set({ config, status: 'connected', lastSyncAt: new Date(), lastError: null })
            .where(eq(schema.connectorConfig.id, existing.id));
        } else {
          await tx.insert(schema.connectorConfig).values({
            tenantId,
            siteId: null,
            kind: 'machine_brand',
            provider: 'miele',
            config,
            secretRef: conn.secretRef,
            status: 'connected',
            lastSyncAt: new Date(),
          });
        }
      });
    } catch (err) {
      this.logger.warn(`connector_config persistence skipped: ${(err as Error).message}`);
    }
  }

  private async markDisconnected(conn: Connection): Promise<void> {
    await this.db.run(async (tx) => {
      await tx
        .update(schema.connectorConfig)
        .set({ status: 'not_connected', secretRef: null })
        .where(
          and(
            eq(schema.connectorConfig.provider, 'miele'),
            eq(schema.connectorConfig.secretRef, conn.secretRef),
          ),
        );
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private toAccount(c: Connection): MieleAccount {
    return {
      id: c.id,
      label: c.label,
      vg: c.vg,
      applianceCount: c.appliances.length,
      simulated: c.simulated,
      connectedAt: c.connectedAt,
    };
  }

  private demoAppliances(accountId: string): MieleAppliance[] {
    const demo: Array<[string, string, string, string]> = [
      ['000160212345', 'Lave-linge Miele PWM', 'Washing machine', 'PWM 507'],
      ['000160212346', 'Sèche-linge Miele PDR', 'Tumble dryer', 'PDR 507'],
      ['000160212347', 'Lave-linge séchant Miele', 'Washer dryer', 'WTR 870'],
    ];
    return demo.map(([id, name, type, model]) => ({
      applianceId: `${accountId}-${id}`,
      name,
      type,
      model,
      serial: id,
      connected: true,
      accountId,
      siteId: null,
      siteName: null,
      machineId: null,
    }));
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.createdAt > CONSENT_TTL_MS) this.pending.delete(k);
  }
}

/** Map a Miele device-type label to our machine_kind (washer fallback). */
export function mieleKindOf(typeLabel: string): 'washer' | 'dryer' | 'combo' | 'dispenser' {
  return mapMieleType(undefined, typeLabel);
}

interface MieleDevice {
  ident?: {
    type?: { value_raw?: number; value_localized?: string };
    deviceName?: string;
    deviceIdentLabel?: { fabNumber?: string; techType?: string };
  };
  state?: { status?: { value_raw?: number } };
}
