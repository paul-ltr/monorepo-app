import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import {
  type ElectroluxAppliance,
  type ElectroluxAccount,
  type ElectroluxAssociateInput,
  type ElectroluxBrandKind,
  type ElectroluxConnectInput,
  type ElectroluxConnectResult,
  type ElectroluxStatus,
  type RequestContext,
  ELECTROLUX_BRAND_CLIENTS,
  buildGigyaBaseString,
  gigyaGetIdsUrl,
  gigyaGetJwtUrl,
  gigyaLoginUrl,
  ocpAppliancesInfoUrl,
  ocpAppliancesUrl,
  ocpIdentityProvidersUrl,
  ocpTokenUrl,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { loadEnv } from '@/config/env';
import { AuditService } from './audit.service';
import { SecretStore } from './secret-store.service';

/** A live (or simulated) connection to one Electrolux group account. */
interface Connection {
  id: string;
  label: string;
  brand: ElectroluxBrandKind;
  countryCode: string;
  regionBase: string;
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: number;
  simulated: boolean;
  connectedAt: string;
  secretRef: string;
  appliances: ElectroluxAppliance[];
}

const GIGYA_SDK = 'Android_6.2.1';

/**
 * M1/M12 — Electrolux OneApp / OCP connector. Logs a user's Electrolux (or AEG)
 * group account in with email + password (via the Gigya SAP-CDC identity flow),
 * lists their appliances, and lets each appliance be associated with a shop
 * (site) — which materialises a `core.machine` row so it flows into supervision
 * and is visible to the data repo through `core.v_machine`.
 *
 * When `ELECTROLUX_ENABLED=false` (default) or no email is supplied, the flow is
 * *simulated*: demo appliances are returned and no live login happens — mirroring
 * how EnedisService/PennylaneService degrade without credentials. Connections are
 * kept in memory per tenant (MVP); the durable record is `core.connector_config`
 * plus the refresh token stored via SecretStore at `secret_ref`.
 */
@Injectable()
export class ElectroluxService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(ElectroluxService.name);
  /** tenantId → (accountId → connection). */
  private readonly byTenant = new Map<string, Map<string, Connection>>();

  constructor(
    private readonly db: ScopedDb,
    private readonly audit: AuditService,
    private readonly secrets: SecretStore,
  ) {}

  private accounts(tenantId: string): Map<string, Connection> {
    const existing = this.byTenant.get(tenantId);
    if (existing) return existing;
    const fresh = new Map<string, Connection>();
    this.byTenant.set(tenantId, fresh);
    return fresh;
  }

  private brandClient(brand: ElectroluxBrandKind) {
    const base = ELECTROLUX_BRAND_CLIENTS[brand];
    return {
      apiKey: this.env.ELECTROLUX_API_KEY ?? base.apiKey,
      clientId: base.clientId,
      clientSecret: this.env.ELECTROLUX_CLIENT_SECRET ?? base.clientSecret,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  status(tenantId: string): ElectroluxStatus {
    const conns = [...this.accounts(tenantId).values()];
    return {
      accounts: conns.map((c) => this.toAccount(c)),
      appliances: conns.flatMap((c) => c.appliances),
      simulated: !this.env.ELECTROLUX_ENABLED,
    };
  }

  async connect(tenantId: string, input: ElectroluxConnectInput): Promise<ElectroluxConnectResult> {
    const simulated = !this.env.ELECTROLUX_ENABLED || input.email.length === 0;
    const brand = input.brand;
    const accountId = randomUUID();
    const label =
      input.label?.trim() ||
      (input.email ? input.email : `Compte ${brand} (démo)`);
    const secretRef = this.secrets.ref({ provider: 'electrolux', tenantId, key: accountId });

    if (simulated) {
      const appliances = this.demoAppliances(accountId);
      const conn: Connection = {
        id: accountId,
        label,
        brand,
        countryCode: input.countryCode,
        regionBase: this.env.ELECTROLUX_OCP_BASE,
        refreshToken: `sandbox-${accountId}`,
        accessToken: null,
        expiresAt: Date.now() + 86_400_000,
        simulated: true,
        connectedAt: new Date().toISOString(),
        secretRef,
        appliances,
      };
      await this.secrets.put(secretRef, conn.refreshToken!);
      this.accounts(tenantId).set(accountId, conn);
      await this.persistConfig(tenantId, conn);
      return {
        status: 'connected',
        account: this.toAccount(conn),
        appliances,
        message: `Compte Electrolux connecté (simulation) — ${appliances.length} appareils.`,
        simulated: true,
      };
    }

    try {
      const { apiKey, clientId, clientSecret } = this.brandClient(brand);
      const base = this.env.ELECTROLUX_OCP_BASE;

      // 1. client-credentials token → used to read identity providers.
      const clientToken = await this.clientCredToken(base, apiKey, clientId, clientSecret);

      // 2. identity providers → Gigya {domain, apiKey} + the regional base URL.
      const idp = await this.identityProviders(base, apiKey, clientToken, brand, input.countryCode);
      const regionBase = idp.httpRegionalBaseUrl || base;

      // 3. Gigya login (email/password) → id_token.
      const idToken = await this.gigyaLogin(idp.domain, idp.apiKey, input.email, input.password);

      // 4. Exchange the Gigya id_token for OCP user tokens.
      const tokens = await this.exchangeToken(regionBase, apiKey, clientId, idToken);

      // 5. List the account's appliances (+ their metadata).
      const appliances = await this.fetchAppliances(regionBase, apiKey, tokens.accessToken, accountId);

      const conn: Connection = {
        id: accountId,
        label,
        brand,
        countryCode: input.countryCode,
        regionBase,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        simulated: false,
        connectedAt: new Date().toISOString(),
        secretRef,
        appliances,
      };
      if (tokens.refreshToken) await this.secrets.put(secretRef, tokens.refreshToken);
      this.accounts(tenantId).set(accountId, conn);
      await this.persistConfig(tenantId, conn);
      return {
        status: 'connected',
        account: this.toAccount(conn),
        appliances,
        message: `Compte Electrolux connecté — ${appliances.length} appareils récupérés.`,
        simulated: false,
      };
    } catch (err) {
      this.logger.error(`Electrolux connect failed: ${(err as Error).message}`);
      return {
        status: 'error',
        account: null,
        appliances: [],
        message:
          'Échec de la connexion Electrolux. Vérifiez l’e-mail, le mot de passe et le pays du compte.',
        simulated: false,
      };
    }
  }

  async associate(
    ctx: RequestContext,
    input: ElectroluxAssociateInput,
  ): Promise<ElectroluxStatus> {
    const conn = this.accounts(ctx.tenantId).get(input.accountId);
    const appliance = conn?.appliances.find((a) => a.applianceId === input.applianceId);
    if (!conn || !appliance) return this.status(ctx.tenantId);

    const machineId = await this.upsertMachine(ctx, appliance, input.siteId);
    appliance.siteId = input.siteId;
    appliance.machineId = machineId;
    appliance.siteName = null; // resolved client-side from the sites list
    return this.status(ctx.tenantId);
  }

  async disconnect(ctx: RequestContext, accountId: string): Promise<ElectroluxStatus> {
    const conn = this.accounts(ctx.tenantId).get(accountId);
    if (conn) {
      await this.secrets.delete(conn.secretRef).catch(() => undefined);
      await this.markDisconnected(ctx.tenantId, conn).catch(() => undefined);
      this.accounts(ctx.tenantId).delete(accountId);
      await this.audit
        .record(ctx, 'connector.electrolux.disconnected', 'connector_config', accountId)
        .catch(() => undefined);
    }
    return this.status(ctx.tenantId);
  }

  // ── OCP HTTP (only reached in live mode) ────────────────────────────────────

  private async clientCredToken(
    base: string,
    apiKey: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const res = await fetch(ocpTokenUrl(base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ grantType: 'client_credentials', clientId, clientSecret, scope: '' }),
    });
    if (!res.ok) throw new Error(`client-cred token ${res.status}`);
    const json = (await res.json()) as { accessToken?: string; tokenType?: string };
    if (!json.accessToken) throw new Error('no client-cred accessToken');
    return `${json.tokenType ?? 'Bearer'} ${json.accessToken}`;
  }

  private async identityProviders(
    base: string,
    apiKey: string,
    clientToken: string,
    brand: string,
    countryCode: string,
  ): Promise<{ domain: string; apiKey: string; httpRegionalBaseUrl: string }> {
    const res = await fetch(ocpIdentityProvidersUrl(base, brand, countryCode), {
      headers: { 'x-api-key': apiKey, Authorization: clientToken },
    });
    if (!res.ok) throw new Error(`identity-providers ${res.status}`);
    const json = (await res.json()) as Array<{
      domain: string;
      apiKey: string;
      httpRegionalBaseUrl: string;
    }>;
    const first = json[0];
    if (!first?.domain || !first?.apiKey) throw new Error('no identity provider');
    return first;
  }

  private async exchangeToken(
    regionBase: string,
    apiKey: string,
    clientId: string,
    idToken: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
    const country = decodeJwt(idToken)?.country;
    const res = await fetch(ocpTokenUrl(regionBase), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...(country ? { 'Origin-Country-Code': String(country) } : {}),
      },
      body: JSON.stringify({
        grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
        clientId,
        idToken,
        scope: '',
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const json = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    if (!json.accessToken) throw new Error('no user accessToken');
    return {
      accessToken: json.accessToken,
      refreshToken: json.refreshToken ?? null,
      expiresIn: json.expiresIn ?? 43_200,
    };
  }

  private async fetchAppliances(
    regionBase: string,
    apiKey: string,
    accessToken: string,
    accountId: string,
  ): Promise<ElectroluxAppliance[]> {
    const authHeaders = { 'x-api-key': apiKey, Authorization: `Bearer ${accessToken}` };
    const listRes = await fetch(ocpAppliancesUrl(regionBase, true), { headers: authHeaders });
    if (!listRes.ok) throw new Error(`appliances ${listRes.status}`);
    const list = (await listRes.json()) as Array<{
      applianceId: string;
      applianceName?: string;
      connectionState?: string;
    }>;
    const ids = list.map((a) => a.applianceId);

    // Best-effort metadata (serial/model/type) for all appliances at once.
    const info = new Map<string, { serialNumber?: string; model?: string; deviceType?: string; applianceName?: string }>();
    if (ids.length > 0) {
      try {
        const infoRes = await fetch(ocpAppliancesInfoUrl(regionBase), {
          method: 'POST',
          headers: { ...authHeaders, 'content-type': 'application/json' },
          body: JSON.stringify({ applianceIds: ids }),
        });
        if (infoRes.ok) {
          const infoJson = (await infoRes.json()) as Array<{
            applianceId: string;
            applianceInfo?: { serialNumber?: string; model?: string; deviceType?: string };
            applianceData?: { applianceName?: string };
          }>;
          for (const it of infoJson)
            info.set(it.applianceId, { ...it.applianceInfo, applianceName: it.applianceData?.applianceName });
        }
      } catch (err) {
        this.logger.warn(`appliances/info failed: ${(err as Error).message}`);
      }
    }

    return list.map((a) => {
      const meta = info.get(a.applianceId) ?? {};
      const type = meta.deviceType ?? 'UNKNOWN';
      return {
        applianceId: a.applianceId,
        name: a.applianceName ?? meta.applianceName ?? a.applianceId,
        type,
        model: meta.model ?? null,
        serial: meta.serialNumber ?? null,
        connected: (a.connectionState ?? '').toLowerCase() === 'connected',
        accountId,
        siteId: null,
        siteName: null,
        machineId: null,
      } satisfies ElectroluxAppliance;
    });
  }

  // ── Gigya (SAP CDC) login ───────────────────────────────────────────────────

  private nonce(): string {
    return `${Date.now()}_${randomInt(1_000_000_000, 10_000_000_000)}`;
  }

  private async gigyaLogin(
    domain: string,
    apiKey: string,
    email: string,
    password: string,
  ): Promise<string> {
    // a. socialize.getIDs → gmid/ucid device identifiers.
    const ids = (await this.gigyaPost(gigyaGetIdsUrl(domain), {
      apiKey,
      format: 'json',
      httpStatusCodes: 'true',
      nonce: this.nonce(),
      sdk: GIGYA_SDK,
      targetEnv: 'mobile',
    })) as { gmid?: string; ucid?: string };
    if (!ids.gmid || !ids.ucid) throw new Error('gigya getIDs failed');

    // b. accounts.login → session token + secret.
    const login = (await this.gigyaPost(gigyaLoginUrl(domain), {
      apiKey,
      format: 'json',
      gmid: ids.gmid,
      httpStatusCodes: 'true',
      loginID: email,
      nonce: this.nonce(),
      password,
      sdk: GIGYA_SDK,
      targetEnv: 'mobile',
      ucid: ids.ucid,
    })) as { errorCode?: number; sessionInfo?: { sessionToken?: string; sessionSecret?: string } };
    const session = login.sessionInfo;
    if (login.errorCode || !session?.sessionToken || !session?.sessionSecret) {
      throw new Error(`gigya login failed (errorCode ${login.errorCode ?? '?'})`);
    }

    // c. accounts.getJWT → id_token, signed OAuth1-style with the session secret.
    const params: Record<string, string> = {
      apiKey,
      fields: 'country',
      format: 'json',
      gmid: ids.gmid,
      httpStatusCodes: 'true',
      nonce: this.nonce(),
      oauth_token: session.sessionToken,
      sdk: GIGYA_SDK,
      targetEnv: 'mobile',
      timestamp: String(Math.floor(Date.now() / 1000)),
      ucid: ids.ucid,
    };
    const url = gigyaGetJwtUrl(domain);
    const baseString = buildGigyaBaseString('POST', url, params);
    params.sig = createHmac('sha1', Buffer.from(session.sessionSecret, 'base64'))
      .update(baseString)
      .digest('base64');

    const jwt = (await this.gigyaPost(url, params)) as { errorCode?: number; id_token?: string };
    if (jwt.errorCode || !jwt.id_token) throw new Error(`gigya getJWT failed (errorCode ${jwt.errorCode ?? '?'})`);
    return jwt.id_token;
  }

  private async gigyaPost(url: string, params: Record<string, string>): Promise<unknown> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    // Gigya returns 200 with an errorCode in the body (httpStatusCodes=true also
    // surfaces non-200s) — parse regardless so callers can read errorCode.
    return (await res.json()) as unknown;
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  /** Upsert a core.machine for an appliance and return its id (best-effort). */
  private async upsertMachine(
    ctx: RequestContext,
    appliance: ElectroluxAppliance,
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
        const kind = mapDeviceType(appliance.type);
        const serial = appliance.serial ?? appliance.applianceId;
        if (existing) {
          await tx
            .update(schema.machine)
            .set({ siteId, kind, model: appliance.model, serial })
            .where(eq(schema.machine.id, existing.id));
          await this.audit.record(ctx, 'connector.electrolux.appliance_linked', 'machine', existing.id);
          return existing.id;
        }
        const inserted = (
          await tx
            .insert(schema.machine)
            .values({
              tenantId: ctx.tenantId,
              siteId,
              kind,
              brand: 'electrolux',
              model: appliance.model,
              serial,
              status: 'offline',
              externalRef: appliance.applianceId,
            })
            .returning({ id: schema.machine.id })
        )[0];
        if (inserted) {
          await this.audit.record(ctx, 'connector.electrolux.appliance_linked', 'machine', inserted.id);
        }
        return inserted?.id ?? null;
      });
    } catch (err) {
      // No-DB demo path — keep the wizard functional.
      this.logger.warn(`machine upsert skipped: ${(err as Error).message}`);
      return null;
    }
  }

  /** Upsert the connector_config row for this account (best-effort). */
  private async persistConfig(tenantId: string, conn: Connection): Promise<void> {
    const config = {
      accountId: conn.id,
      accountLabel: conn.label,
      brand: conn.brand,
      countryCode: conn.countryCode,
      regionBase: conn.regionBase,
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
                eq(schema.connectorConfig.provider, 'electrolux'),
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
            provider: 'electrolux',
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

  private async markDisconnected(tenantId: string, conn: Connection): Promise<void> {
    await this.db.run(async (tx) => {
      await tx
        .update(schema.connectorConfig)
        .set({ status: 'not_connected', secretRef: null })
        .where(
          and(
            eq(schema.connectorConfig.provider, 'electrolux'),
            eq(schema.connectorConfig.secretRef, conn.secretRef),
          ),
        );
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private toAccount(c: Connection): ElectroluxAccount {
    return {
      id: c.id,
      label: c.label,
      brand: c.brand,
      countryCode: c.countryCode,
      applianceCount: c.appliances.length,
      simulated: c.simulated,
      connectedAt: c.connectedAt,
    };
  }

  private demoAppliances(accountId: string): ElectroluxAppliance[] {
    const demo: Array<[string, string, string, string]> = [
      ['950011538000123', 'Lave-linge Pro WD6', 'WASHING_MACHINE', 'WD6-8'],
      ['950011538000124', 'Sèche-linge Pro TD6', 'TUMBLE_DRYER', 'TD6-14'],
      ['950011538000125', 'Lave-linge Pro WD6', 'WASHING_MACHINE', 'WD6-10'],
    ];
    return demo.map(([id, name, type, model]) => ({
      applianceId: id,
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
}

/** Map an OCP deviceType to our machine_kind enum (washer fallback). */
export function mapDeviceType(deviceType: string): 'washer' | 'dryer' | 'combo' | 'dispenser' {
  const t = deviceType.toUpperCase();
  // Order matters: a washer-dryer contains "DRYER", so match combo first.
  if (t.includes('WASHER_DRYER') || t.includes('WASHERDRYER') || t.includes('COMBO')) return 'combo';
  if (t.includes('DRYER') || t === 'TD') return 'dryer';
  if (t.includes('DISPENSER') || t.includes('DOSING')) return 'dispenser';
  return 'washer';
}

/** Decode a JWT payload without verifying (we only need the `country` claim). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
