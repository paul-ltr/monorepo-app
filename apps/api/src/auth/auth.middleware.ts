import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { schema, withTenantContext, type Database } from '@pilotage/db';
import {
  AppError,
  ROLE_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  isLavoPilotStaff,
  type PermissionKey,
  type RequestContext,
  type SystemRoleKey,
} from '@pilotage/shared';
import { DATABASE } from '@/db/db.module';
import { requestContextStore } from '@/common/request-context';
import { loadEnv } from '@/config/env';
import { verifyCognitoToken } from './cognito';

/** Cognito group whose members are LavoPilot back-office staff (superuser). */
const STAFF_COGNITO_GROUP = 'lavopilot-staff';

/**
 * Resolves the per-request identity and runs the rest of the request inside an
 * AsyncLocalStorage scope carrying it. Two modes:
 *  - AUTH_DEV_BYPASS=true → trust the seeded demo user (cognito_sub from header
 *    `x-dev-user`, default the demo owner). Never enable outside dev.
 *  - otherwise → verify the Cognito JWT and resolve the user by cognito_sub.
 * Permissions are derived from the user's system roles (RBAC catalog in shared).
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly env = loadEnv();
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const identity = await this.resolveIdentity(req);
    const ctx = await this.buildContext(identity, req);
    requestContextStore.run(ctx, () => next());
  }

  private async resolveIdentity(req: Request): Promise<{ sub: string; groups: string[] }> {
    if (this.env.AUTH_DEV_BYPASS) {
      return { sub: (req.header('x-dev-user') ?? 'dev-sophie-diallo').trim(), groups: [] };
    }
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) {
      throw new AppError('unauthenticated', 'Jeton manquant');
    }
    return verifyCognitoToken(auth.slice(7), this.env);
  }

  private async buildContext(
    identity: { sub: string; groups: string[] },
    req: Request,
  ): Promise<RequestContext> {
    const user = (
      await this.db.select().from(schema.appUser).where(eq(schema.appUser.cognitoSub, identity.sub)).limit(1)
    )[0];
    if (!user) throw new AppError('unauthenticated', 'Utilisateur inconnu');

    const userRoles = await this.db
      .select({ key: schema.role.key })
      .from(schema.userRole)
      .innerJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
      .where(eq(schema.userRole.userId, user.id));

    const roles = userRoles.map((r) => r.key);
    const permissions = this.permissionsFor(roles);

    // First successful sign-in of an invited user flips them to active. Written
    // inside the user's own tenant context so RLS (app_rw is not BYPASSRLS)
    // permits the update; fire-and-forget so auth latency is unaffected.
    if (user.status === 'invited') {
      void withTenantContext(
        this.db,
        { tenantId: user.tenantId, userId: user.id, role: this.env.DATABASE_APP_ROLE },
        (tx) =>
          tx
            .update(schema.appUser)
            .set({ status: 'active', lastLoginAt: new Date() })
            .where(eq(schema.appUser.id, user.id)),
      ).catch((err) => this.logger.warn(`activate-on-login failed for ${user.id}: ${err.message}`));
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
      scope: { type: 'tenant', id: user.tenantId },
      locale: user.locale ?? req.header('accept-language')?.split(',')[0] ?? 'fr-FR',
      // Back-office (superuser) membership must come from an IdP-verified Cognito
      // group, NOT the (tenant-mutable) email column. The email-domain check is a
      // dev-only convenience, reachable solely under AUTH_DEV_BYPASS — which is
      // itself forbidden in production (see config/env.ts loadEnv).
      superuser: this.env.AUTH_DEV_BYPASS
        ? isLavoPilotStaff(user.email)
        : identity.groups.includes(STAFF_COGNITO_GROUP),
    };
  }

  private permissionsFor(roles: string[]): PermissionKey[] {
    const set = new Set<PermissionKey>();
    for (const role of roles) {
      const grants = ROLE_PERMISSIONS[role as SystemRoleKey];
      if (grants) for (const p of grants) set.add(p);
    }
    // Unknown/custom roles fall back to no grants; owners already cover ALL.
    return set.size ? [...set] : roles.includes('owner') ? [...ALL_PERMISSION_KEYS] : [];
  }
}
