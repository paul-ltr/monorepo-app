import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { schema, type Database } from '@pilotage/db';
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

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const cognitoSub = await this.resolveSub(req);
    const ctx = await this.buildContext(cognitoSub, req);
    requestContextStore.run(ctx, () => next());
  }

  private async resolveSub(req: Request): Promise<string> {
    if (this.env.AUTH_DEV_BYPASS) {
      return (req.header('x-dev-user') ?? 'dev-sophie-diallo').trim();
    }
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) {
      throw new AppError('unauthenticated', 'Jeton manquant');
    }
    const claims = await verifyCognitoToken(auth.slice(7), this.env);
    return claims.sub;
  }

  private async buildContext(cognitoSub: string, req: Request): Promise<RequestContext> {
    const user = (
      await this.db.select().from(schema.appUser).where(eq(schema.appUser.cognitoSub, cognitoSub)).limit(1)
    )[0];
    if (!user) throw new AppError('unauthenticated', 'Utilisateur inconnu');

    const userRoles = await this.db
      .select({ key: schema.role.key })
      .from(schema.userRole)
      .innerJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
      .where(eq(schema.userRole.userId, user.id));

    const roles = userRoles.map((r) => r.key);
    const permissions = this.permissionsFor(roles);

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
      scope: { type: 'tenant', id: user.tenantId },
      locale: user.locale ?? req.header('accept-language')?.split(',')[0] ?? 'fr-FR',
      // Dev bypass trusts the operator; otherwise LavoPilot staff by email domain.
      superuser: this.env.AUTH_DEV_BYPASS || isLavoPilotStaff(user.email),
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
