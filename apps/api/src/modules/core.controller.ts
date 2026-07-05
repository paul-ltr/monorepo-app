import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import { updateSiteSmsInput, type Site, type TenantBranding } from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { Ctx, RequirePermission } from '@/auth/rbac';
import type { RequestContext } from '@pilotage/shared';
import type { SessionInfo } from '@pilotage/api-client';

/** Identity, white-label branding, and the tenant's sites — DB-backed, RLS-scoped. */
@ApiTags('core')
@Controller()
export class CoreController {
  constructor(private readonly db: ScopedDb) {}

  @Get('me')
  me(@Ctx() ctx: RequestContext): SessionInfo {
    return {
      user: { id: ctx.userId, email: ctx.email, fullName: ctx.email },
      tenant: { id: ctx.tenantId, name: '' },
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
    const rows = await this.db.run((tx) => tx.select().from(schema.site));
    return rows.map(toSite);
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
    if (!row) throw new Error('site not found');
    return toSite(row);
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
    timezone: s.timezone,
    status: s.status,
    openedAt: s.openedAt ? s.openedAt.toISOString() : null,
  };
}
