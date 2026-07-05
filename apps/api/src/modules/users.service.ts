import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import {
  AppError,
  type AppUser,
  type InviteUserInput,
  type RequestContext,
  type UpdateUserRolesInput,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { AuditService } from './audit.service';
import { CognitoAdminService } from './cognito-admin.service';

/** Roles a non-owner (network admin) is never allowed to grant. */
const PRIVILEGED_ROLES = new Set(['owner', 'network_admin']);

/**
 * Tenant-facing user management (M12): list users, invite via Cognito, change
 * roles, disable. All writes are RLS-scoped to the caller's tenant. Distinct
 * from the superuser `ConsoleService` (cross-tenant, no Cognito).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly db: ScopedDb,
    private readonly cognito: CognitoAdminService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AppUser[]> {
    const users = await this.db.run((tx) => tx.select().from(schema.appUser));
    if (users.length === 0) return [];
    const roleRows = await this.db.run((tx) =>
      tx
        .select({ userId: schema.userRole.userId, key: schema.role.key })
        .from(schema.userRole)
        .innerJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
        .where(
          inArray(
            schema.userRole.userId,
            users.map((u) => u.id),
          ),
        ),
    );
    const byUser = new Map<string, string[]>();
    for (const r of roleRows) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r.key);
    return users.map((u) => toAppUser(u, byUser.get(u.id) ?? []));
  }

  async invite(ctx: RequestContext, input: InviteUserInput): Promise<AppUser> {
    await this.assertScopeAllowed(ctx, input);

    // Fail fast on a duplicate email before touching Cognito.
    const existing = await this.db.run((tx) =>
      tx
        .select({ id: schema.appUser.id })
        .from(schema.appUser)
        .where(eq(sql`lower(${schema.appUser.email})`, input.email.toLowerCase()))
        .limit(1),
    );
    if (existing[0]) throw new AppError('conflict', 'Un utilisateur avec cet email existe déjà');

    const { sub } = await this.cognito.adminCreateUser({
      email: input.email,
      fullName: input.fullName,
    });

    let userId: string;
    try {
      userId = await this.db.run(async (tx) => {
        const user = (
          await tx
            .insert(schema.appUser)
            .values({
              tenantId: ctx.tenantId,
              email: input.email,
              fullName: input.fullName,
              cognitoSub: sub,
              status: 'invited',
            })
            .returning()
        )[0]!;
        for (const key of input.roleKeys) {
          const roleId = await this.roleId(tx, key);
          if (!roleId) throw new AppError('validation_failed', `Rôle inconnu : ${key}`);
          await tx.insert(schema.userRole).values({
            userId: user.id,
            roleId,
            scopeType: input.scopeType,
            scopeId: input.scopeId ?? ctx.tenantId,
          });
        }
        return user.id;
      });
    } catch (err) {
      // Roll back the Cognito user so the email can be re-invited.
      await this.cognito.adminDeleteUser(input.email);
      throw err;
    }

    await this.audit.record(ctx, 'user.invite', 'app_user', userId);
    return (await this.getUser(userId))!;
  }

  async updateRoles(ctx: RequestContext, input: UpdateUserRolesInput): Promise<AppUser> {
    await this.assertScopeAllowed(ctx, input);
    const target = await this.getUser(input.userId);
    if (!target) throw new AppError('not_found', 'Utilisateur introuvable');

    await this.db.run(async (tx) => {
      await tx.delete(schema.userRole).where(eq(schema.userRole.userId, input.userId));
      for (const key of input.roleKeys) {
        const roleId = await this.roleId(tx, key);
        if (!roleId) throw new AppError('validation_failed', `Rôle inconnu : ${key}`);
        await tx.insert(schema.userRole).values({
          userId: input.userId,
          roleId,
          scopeType: input.scopeType,
          scopeId: input.scopeId ?? ctx.tenantId,
        });
      }
    });
    await this.audit.record(ctx, 'user.roles.update', 'app_user', input.userId);
    return (await this.getUser(input.userId))!;
  }

  async disable(ctx: RequestContext, userId: string): Promise<AppUser> {
    const target = await this.getUser(userId);
    if (!target) throw new AppError('not_found', 'Utilisateur introuvable');
    if (userId === ctx.userId) throw AppError.forbidden('Vous ne pouvez pas désactiver votre propre compte');

    await this.db.run((tx) =>
      tx.update(schema.appUser).set({ status: 'disabled' }).where(eq(schema.appUser.id, userId)),
    );
    await this.cognito.adminDisableUser(target.email);
    await this.audit.record(ctx, 'user.disable', 'app_user', userId);
    return (await this.getUser(userId))!;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async getUser(id: string): Promise<AppUser | null> {
    const rows = await this.db.run((tx) =>
      tx.select().from(schema.appUser).where(eq(schema.appUser.id, id)).limit(1),
    );
    const u = rows[0];
    if (!u) return null;
    const roleRows = await this.db.run((tx) =>
      tx
        .select({ key: schema.role.key })
        .from(schema.userRole)
        .innerJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
        .where(eq(schema.userRole.userId, id)),
    );
    return toAppUser(u, roleRows.map((r) => r.key));
  }

  private async roleId(
    tx: Parameters<Parameters<ScopedDb['run']>[0]>[0],
    key: string,
  ): Promise<string | null> {
    // RLS lets this see system roles (tenant_id null) + the caller's own roles.
    const row = (await tx.select({ id: schema.role.id }).from(schema.role).where(eq(schema.role.key, key)).limit(1))[0];
    return row?.id ?? null;
  }

  /**
   * Prevent a network admin from escalating privilege. Owners may grant anything;
   * a non-owner (network admin) cannot grant owner/network_admin and, when scoped
   * to specific networks, can only assign within those networks.
   */
  private async assertScopeAllowed(
    ctx: RequestContext,
    input: { roleKeys: string[]; scopeType: 'tenant' | 'network' | 'site'; scopeId?: string },
  ): Promise<void> {
    if (ctx.roles.includes('owner')) return;

    if (input.roleKeys.some((k) => PRIVILEGED_ROLES.has(k))) {
      throw AppError.forbidden("Un admin de réseau ne peut pas attribuer les rôles propriétaire ou admin de réseau");
    }

    const myNetworks = await this.myNetworkScopeIds(ctx.userId);
    if (myNetworks.length === 0) return; // tenant-scoped admin — bounded by RLS to the tenant

    if (input.scopeType === 'tenant') {
      throw AppError.forbidden('Un admin de réseau doit cibler un réseau ou un site précis');
    }
    if (input.scopeType === 'network') {
      if (!input.scopeId || !myNetworks.includes(input.scopeId)) {
        throw AppError.forbidden('Réseau hors de votre périmètre');
      }
      return;
    }
    // site scope → the site's network must be one of the admin's networks.
    const site = await this.db.run((tx) =>
      tx
        .select({ networkId: schema.site.networkId })
        .from(schema.site)
        .where(and(eq(schema.site.id, input.scopeId ?? ''), isNull(schema.site.deletedAt)))
        .limit(1),
    );
    const netId = site[0]?.networkId;
    if (!netId || !myNetworks.includes(netId)) {
      throw AppError.forbidden('Site hors de votre périmètre');
    }
  }

  private async myNetworkScopeIds(userId: string): Promise<string[]> {
    const rows = await this.db.run((tx) =>
      tx
        .select({ scopeId: schema.userRole.scopeId })
        .from(schema.userRole)
        .where(and(eq(schema.userRole.userId, userId), eq(schema.userRole.scopeType, 'network'))),
    );
    return rows.map((r) => r.scopeId).filter((id): id is string => !!id);
  }
}

function toAppUser(u: typeof schema.appUser.$inferSelect, roles: string[]): AppUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    email: u.email,
    fullName: u.fullName,
    locale: u.locale,
    status: (['active', 'invited', 'disabled'].includes(u.status) ? u.status : 'active') as AppUser['status'],
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    roles,
  };
}
