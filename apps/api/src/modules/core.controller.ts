import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import type { Site, TenantBranding } from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { Ctx } from '@/auth/rbac';
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
    };
  }

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
  async sites(): Promise<Site[]> {
    const rows = await this.db.run((tx) => tx.select().from(schema.site));
    return rows.map((s) => ({
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
      timezone: s.timezone,
      status: s.status,
      openedAt: s.openedAt ? s.openedAt.toISOString() : null,
    }));
  }
}
