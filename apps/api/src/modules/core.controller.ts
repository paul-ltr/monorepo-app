import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import {
  AppError,
  createSiteInput,
  siteContactInput,
  updateSiteInput,
  updateSiteSmsInput,
  type Site,
  type SiteContact,
  type TenantBranding,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { Ctx, RequirePermission } from '@/auth/rbac';
import { AuditService } from './audit.service';
import type { RequestContext } from '@pilotage/shared';
import type { SessionInfo } from '@pilotage/api-client';

/** Identity, white-label branding, and the tenant's sites — DB-backed, RLS-scoped. */
@ApiTags('core')
@Controller()
export class CoreController {
  constructor(
    private readonly db: ScopedDb,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  async me(@Ctx() ctx: RequestContext): Promise<SessionInfo> {
    const [row] = await this.db.run((tx) =>
      tx
        .select({ name: schema.tenant.name })
        .from(schema.tenant)
        .where(eq(schema.tenant.id, ctx.tenantId))
        .limit(1),
    );
    return {
      user: { id: ctx.userId, email: ctx.email, fullName: ctx.email },
      tenant: { id: ctx.tenantId, name: row?.name ?? '' },
      roles: ctx.roles,
      permissions: ctx.permissions,
      superuser: ctx.superuser,
    };
  }

  // Ungated like /me: non-sensitive self-tenant theming (name/logo/colour) the
  // shell needs to render for any authenticated user; still RLS-scoped.
  @Get('branding')
  async branding(@Ctx() ctx: RequestContext): Promise<TenantBranding> {
    const row = await this.db.run((tx) =>
      tx.select().from(schema.tenantBranding).where(eq(schema.tenantBranding.tenantId, ctx.tenantId)).limit(1),
    );
    const b = row[0];
    return {
      tenantId: ctx.tenantId,
      appName: b?.appName ?? 'Pilotage',
      logoUrl: b?.logoUrl ?? null,
      primaryColor: b?.primaryColor ?? '#1B4DB3',
    };
  }

  @Get('sites')
  @RequirePermission('M1:dashboard:view')
  async sites(): Promise<Site[]> {
    const rows = await this.db.run((tx) =>
      tx.select().from(schema.site).where(isNull(schema.site.deletedAt)),
    );
    return rows.map(toSite);
  }

  /** Create a new site. RLS scopes it to the caller's tenant. */
  @Post('sites')
  @RequirePermission('M12:sites:manage')
  async createSite(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<Site> {
    const input = createSiteInput.parse(body);
    const rows = await this.db.run((tx) =>
      tx
        .insert(schema.site)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          networkId: input.networkId ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          surfaceM2: input.surfaceM2 ?? null,
          smsNumber: input.smsNumber ?? null,
          pdl: input.pdl ?? null,
          pce: input.pce ?? null,
          status: input.status ?? 'active',
        })
        .returning(),
    );
    const row = rows[0]!;
    await this.audit.record(ctx, 'site.create', 'site', row.id);
    return toSite(row);
  }

  /** Partial in-place edit of a site (drives the auto-saving sites table). */
  @Patch('sites/:id')
  @RequirePermission('M12:sites:manage')
  async updateSite(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<Site> {
    const { patch } = updateSiteInput.parse({ patch: body, siteId: id });
    if (Object.keys(patch).length === 0) throw new AppError('validation_failed', 'Aucun champ à mettre à jour');
    const rows = await this.db.run((tx) =>
      tx
        .update(schema.site)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(schema.site.id, id), eq(schema.site.tenantId, ctx.tenantId), isNull(schema.site.deletedAt)))
        .returning(),
    );
    const row = rows[0];
    if (!row) throw new AppError('not_found', 'Site introuvable');
    await this.audit.record(ctx, 'site.update', 'site', row.id);
    return toSite(row);
  }

  /** Soft-delete a site. */
  @Delete('sites/:id')
  @RequirePermission('M12:sites:manage')
  async deleteSite(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    const rows = await this.db.run((tx) =>
      tx
        .update(schema.site)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.site.id, id), eq(schema.site.tenantId, ctx.tenantId), isNull(schema.site.deletedAt)))
        .returning({ id: schema.site.id }),
    );
    if (!rows[0]) throw new AppError('not_found', 'Site introuvable');
    await this.audit.record(ctx, 'site.delete', 'site', id);
    return { ok: true };
  }

  /** Set (or clear) the SMS alert recipient for one site. RLS scopes to tenant. */
  @Post('sites/:id/sms')
  @RequirePermission('M12:sites:manage')
  async setSiteSms(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<Site> {
    const input = updateSiteSmsInput.parse({ ...(body as object), siteId: id });
    const rows = await this.db.run((tx) =>
      tx
        .update(schema.site)
        .set({ smsNumber: input.smsNumber })
        .where(and(eq(schema.site.id, input.siteId), eq(schema.site.tenantId, ctx.tenantId)))
        .returning(),
    );
    const row = rows[0];
    if (!row) throw new AppError('not_found', 'Site introuvable');
    return toSite(row);
  }

  // ── Site contacts (email/phone directory) ─────────────────────────────────

  @Get('sites/:id/contacts')
  async siteContacts(@Param('id') id: string): Promise<SiteContact[]> {
    const rows = await this.db.run((tx) =>
      tx.select().from(schema.siteContact).where(eq(schema.siteContact.siteId, id)),
    );
    return rows.map(toContact);
  }

  @Post('sites/:id/contacts')
  @RequirePermission('M12:sites:manage')
  async addSiteContact(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SiteContact> {
    const input = siteContactInput.parse({ ...(body as object), siteId: id });
    // Guard: the site must belong to the caller's tenant (RLS also enforces it).
    const site = await this.db.run((tx) =>
      tx.select({ id: schema.site.id }).from(schema.site).where(eq(schema.site.id, id)).limit(1),
    );
    if (!site[0]) throw new AppError('not_found', 'Site introuvable');
    const rows = await this.db.run((tx) =>
      tx
        .insert(schema.siteContact)
        .values({
          tenantId: ctx.tenantId,
          siteId: id,
          kind: input.kind,
          value: input.value,
          label: input.label,
          isAlertRecipient: input.isAlertRecipient,
        })
        .returning(),
    );
    await this.audit.record(ctx, 'site.contact.add', 'site', id);
    return toContact(rows[0]!);
  }

  @Delete('sites/:id/contacts/:contactId')
  @RequirePermission('M12:sites:manage')
  async removeSiteContact(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ): Promise<{ ok: true }> {
    const rows = await this.db.run((tx) =>
      tx
        .delete(schema.siteContact)
        .where(and(eq(schema.siteContact.id, contactId), eq(schema.siteContact.siteId, id)))
        .returning({ id: schema.siteContact.id }),
    );
    if (!rows[0]) throw new AppError('not_found', 'Contact introuvable');
    await this.audit.record(ctx, 'site.contact.remove', 'site', id);
    return { ok: true };
  }
}

function toSite(s: typeof schema.site.$inferSelect): Site {
  return {
    id: s.id,
    tenantId: s.tenantId,
    networkId: s.networkId,
    name: s.name,
    address: s.address,
    city: s.city,
    postalCode: s.postalCode,
    lat: s.lat,
    lng: s.lng,
    surfaceM2: s.surfaceM2,
    smsNumber: s.smsNumber,
    pdl: s.pdl,
    pce: s.pce,
    timezone: s.timezone,
    status: s.status,
    openedAt: s.openedAt ? s.openedAt.toISOString() : null,
  };
}

function toContact(c: typeof schema.siteContact.$inferSelect): SiteContact {
  return {
    id: c.id,
    siteId: c.siteId,
    kind: c.kind as SiteContact['kind'],
    value: c.value,
    label: c.label,
    isAlertRecipient: c.isAlertRecipient,
  };
}
