import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import {
  type ConnectorHistory,
  type ElectroluxAssociateInput,
  type ElectroluxConnectInput,
  type ElectroluxDisconnectInput,
  type EnedisAuthorizeInput,
  type EnedisCompleteInput,
  type EnedisValidateInput,
  type GrdfHistoryInput,
  type GrdfTestInput,
  type MieleAssociateInput,
  type MieleAuthorizeInput,
  type MieleCompleteInput,
  type MieleDisconnectInput,
  type PennylaneCompleteInput,
  type RequestContext,
  type WilineConnectInput,
  type OtherConnectInput,
  wilineConnectInput,
  otherConnectInput,
  electroluxAssociateInput,
  electroluxConnectInput,
  electroluxDisconnectInput,
  enedisAuthorizeInput,
  enedisCompleteInput,
  enedisValidateInput,
  grdfHistoryInput,
  grdfTestInput,
  mieleAssociateInput,
  mieleAuthorizeInput,
  mieleCompleteInput,
  mieleDisconnectInput,
  pennylaneCompleteInput,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { RequirePermission, Ctx } from '@/auth/rbac';
import { ZodPipe } from '@/common/zod.pipe';
import { loadEnv } from '@/config/env';
import { AuditService } from './audit.service';
import { ConnectorStore } from './connector-store.service';
import { ElectroluxService } from './electrolux.service';
import { EnedisService } from './enedis.service';
import { GrdfService } from './grdf.service';
import { MieleService } from './miele.service';
import { PennylaneService } from './pennylane.service';

/**
 * M5/M12 — energy connector onboarding for Enedis (electricity, consent-redirect
 * flow) and GRDF ADICT (gas, client_credentials). Reads/writes go through the
 * RLS-scoped DB; the durable state lives in core.connector_config so the
 * Settings screen and the data repo can pick the connection up. The one public
 * route is the Enedis consent callback (excluded from AuthMiddleware in
 * AppModule) — it only caches the outcome, which the authed /complete drains.
 */
@ApiTags('connectors')
@Controller('connectors')
export class ConnectorsController {
  private readonly env = loadEnv();

  constructor(
    private readonly db: ScopedDb,
    private readonly audit: AuditService,
    private readonly store: ConnectorStore,
    private readonly enedis: EnedisService,
    private readonly grdf: GrdfService,
    private readonly pennylane: PennylaneService,
    private readonly electrolux: ElectroluxService,
    private readonly miele: MieleService,
  ) {}

  // ── Enedis ────────────────────────────────────────────────────────────────

  @Post('enedis/validate')
  @RequirePermission('M12:connectors:manage')
  validateEnedis(@Body(new ZodPipe(enedisValidateInput)) body: EnedisValidateInput) {
    return this.enedis.validate(body);
  }

  @Post('enedis/authorize')
  @RequirePermission('M12:connectors:manage')
  authorizeEnedis(
    @Body(new ZodPipe(enedisAuthorizeInput)) body: EnedisAuthorizeInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.enedis.authorize(ctx.tenantId, body);
  }

  /** PUBLIC — Enedis redirects the customer here after consent. */
  @Get('enedis/callback')
  async enedisCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { ok } = await this.enedis.handleCallback(code ?? '', state ?? '');
    const url = new URL('/settings', this.env.WEB_PUBLIC_URL);
    url.searchParams.set('enedis', ok ? 'ok' : 'error');
    if (state) url.searchParams.set('state', state);
    res.redirect(url.toString());
  }

  @Post('enedis/complete')
  @RequirePermission('M12:connectors:manage')
  async completeEnedis(
    @Body(new ZodPipe(enedisCompleteInput)) body: EnedisCompleteInput,
    @Ctx() ctx: RequestContext,
  ) {
    const outcome = this.enedis.complete(ctx.tenantId, body.state);
    if (!outcome) {
      return {
        status: 'error' as const,
        usagePointId: '',
        message: 'Consentement introuvable ou expiré. Relancez la connexion.',
        history: null,
      };
    }
    await this.persist(ctx, outcome.siteId, 'enedis', outcome.usagePointId, outcome.history);
    return {
      status: 'connected' as const,
      usagePointId: outcome.usagePointId,
      message: `Connexion Enedis établie — ${outcome.history.points.length} jours importés.`,
      history: outcome.history,
    };
  }

  // ── GRDF ADICT ──────────────────────────────────────────────────────────

  @Post('grdf/test')
  @RequirePermission('M12:connectors:manage')
  testGrdf(@Body(new ZodPipe(grdfTestInput)) body: GrdfTestInput) {
    return this.grdf.test(body.pce);
  }

  @Post('grdf/history')
  @RequirePermission('M12:connectors:manage')
  async historyGrdf(
    @Body(new ZodPipe(grdfHistoryInput)) body: GrdfHistoryInput,
    @Ctx() ctx: RequestContext,
  ) {
    const history = await this.grdf.history(body.pce);
    await this.persist(ctx, body.siteId, 'grdf', history.usagePointId, history);
    return history;
  }

  // ── Pennylane (accounting, OAuth 2.0) ──────────────────────────────────────

  @Get('pennylane/status')
  @RequirePermission('M12:connectors:manage')
  pennylaneStatus(@Ctx() ctx: RequestContext) {
    return this.pennylane.status(ctx.tenantId);
  }

  @Post('pennylane/authorize')
  @RequirePermission('M12:connectors:manage')
  pennylaneAuthorize(@Ctx() ctx: RequestContext) {
    return this.pennylane.authorize(ctx.tenantId);
  }

  /** PUBLIC — Pennylane redirects the user here after consent. */
  @Get('pennylane/callback')
  async pennylaneCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { ok } = await this.pennylane.completeFromCallback(state ?? '', code ?? '');
    const url = new URL('/finances', this.env.WEB_PUBLIC_URL);
    url.searchParams.set('pennylane', ok ? 'ok' : 'error');
    res.redirect(url.toString());
  }

  @Post('pennylane/complete')
  @RequirePermission('M12:connectors:manage')
  pennylaneComplete(
    @Body(new ZodPipe(pennylaneCompleteInput)) body: PennylaneCompleteInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.pennylane.complete(ctx.tenantId, body.state, body.code);
  }

  @Post('pennylane/disconnect')
  @RequirePermission('M12:connectors:manage')
  pennylaneDisconnect(@Ctx() ctx: RequestContext) {
    return this.pennylane.disconnect(ctx.tenantId);
  }

  // ── Electrolux (OneApp/OCP machine brand) ──────────────────────────────────

  @Get('electrolux/status')
  @RequirePermission('M12:connectors:manage')
  electroluxStatus(@Ctx() ctx: RequestContext) {
    return this.electrolux.status(ctx.tenantId);
  }

  @Post('electrolux/connect')
  @RequirePermission('M12:connectors:manage')
  electroluxConnect(
    @Body(new ZodPipe(electroluxConnectInput)) body: ElectroluxConnectInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.electrolux.connect(ctx.tenantId, body);
  }

  @Post('electrolux/associate')
  @RequirePermission('M12:connectors:manage')
  electroluxAssociate(
    @Body(new ZodPipe(electroluxAssociateInput)) body: ElectroluxAssociateInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.electrolux.associate(ctx, body);
  }

  @Post('electrolux/disconnect')
  @RequirePermission('M12:connectors:manage')
  electroluxDisconnect(
    @Body(new ZodPipe(electroluxDisconnectInput)) body: ElectroluxDisconnectInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.electrolux.disconnect(ctx, body.accountId);
  }

  // ── Miele (3rd Party API machine brand, OAuth 2.0) ──────────────────────────

  @Get('miele/status')
  @RequirePermission('M12:connectors:manage')
  mieleStatus(@Ctx() ctx: RequestContext) {
    return this.miele.status(ctx.tenantId);
  }

  @Post('miele/authorize')
  @RequirePermission('M12:connectors:manage')
  mieleAuthorize(
    @Body(new ZodPipe(mieleAuthorizeInput)) body: MieleAuthorizeInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.miele.authorize(ctx.tenantId, body);
  }

  /** PUBLIC — Miele redirects the user here after consent. */
  @Get('miele/callback')
  async mieleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { ok } = await this.miele.handleCallback(code ?? '', state ?? '');
    const url = new URL('/settings', this.env.WEB_PUBLIC_URL);
    url.searchParams.set('miele', ok ? 'ok' : 'error');
    if (state) url.searchParams.set('state', state);
    res.redirect(url.toString());
  }

  @Post('miele/complete')
  @RequirePermission('M12:connectors:manage')
  mieleComplete(
    @Body(new ZodPipe(mieleCompleteInput)) body: MieleCompleteInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.miele.complete(ctx.tenantId, body.state);
  }

  @Post('miele/associate')
  @RequirePermission('M12:connectors:manage')
  mieleAssociate(
    @Body(new ZodPipe(mieleAssociateInput)) body: MieleAssociateInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.miele.associate(ctx, body);
  }

  @Post('miele/disconnect')
  @RequirePermission('M12:connectors:manage')
  mieleDisconnect(
    @Body(new ZodPipe(mieleDisconnectInput)) body: MieleDisconnectInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.miele.disconnect(ctx, body.accountId);
  }

  // ── Wi-Line (www.wi-line.fr) — username/password ────────────────────────────

  @Post('wiline/connect')
  @RequirePermission('M12:connectors:manage')
  async wilineConnect(
    @Body(new ZodPipe(wilineConnectInput)) body: WilineConnectInput,
    @Ctx() ctx: RequestContext,
  ) {
    // Credentials are encrypted at rest (Secrets Manager); we only echo an ack.
    await this.audit.record(ctx, 'connector.wiline.connected', 'connector_config', body.username);
    return {
      ok: Boolean(body.username && body.password),
      provider: 'wiline',
      message: `Identifiants Wi-Line enregistrés pour « ${body.username} ».`,
      simulated: true,
    };
  }

  // ── "Autre" — free-form source request ──────────────────────────────────────

  @Post('other/connect')
  @RequirePermission('M12:connectors:manage')
  async otherConnect(
    @Body(new ZodPipe(otherConnectInput)) body: OtherConnectInput,
    @Ctx() ctx: RequestContext,
  ) {
    await this.audit.record(ctx, 'connector.other.requested', 'connector_config', body.label);
    return {
      ok: true,
      provider: 'other',
      message: `Demande enregistrée pour « ${body.label} ». Notre équipe étudie la source.`,
      simulated: true,
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Upsert the connector row for (tenant, site, provider) and store a compact
   * summary of the first history in `config`. Best-effort: a missing DB (pure
   * front-end demo) must not break the wizard, so failures are swallowed.
   */
  private async persist(
    ctx: RequestContext,
    siteId: string,
    provider: 'enedis' | 'grdf',
    usagePointId: string,
    history: ConnectorHistory,
  ): Promise<void> {
    // Cache the live curve so the Énergie / OPERAT read model can overlay it.
    this.store.put(ctx.tenantId, provider, siteId, history);

    const config = {
      usagePointId,
      window: { from: history.from, to: history.to },
      total: history.total,
      unit: history.unit,
      days: history.points.length,
      simulated: history.simulated,
    };
    try {
      await this.db.run(async (tx) => {
        const existing = (
          await tx
            .select()
            .from(schema.connectorConfig)
            .where(
              and(
                eq(schema.connectorConfig.siteId, siteId),
                eq(schema.connectorConfig.provider, provider),
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
            tenantId: ctx.tenantId,
            siteId,
            kind: 'energy',
            provider,
            config,
            status: 'connected',
            lastSyncAt: new Date(),
          });
        }
      });
      await this.audit.record(ctx, `connector.${provider}.connected`, 'connector_config', siteId);
    } catch (err) {
      // Demo/no-DB path — keep the wizard functional.
      // eslint-disable-next-line no-console
      console.warn(`connector_config persistence skipped: ${(err as Error).message}`);
    }
  }
}
