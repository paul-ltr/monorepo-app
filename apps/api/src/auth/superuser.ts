import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '@pilotage/shared';
import { getRequestContext } from '@/common/request-context';

/**
 * Guards the back-office console: only LavoPilot staff (`ctx.superuser`) may pass.
 * Applied per-controller via `@UseGuards(SuperuserGuard)` — orthogonal to the
 * tenant RBAC PermissionGuard, since these routes are cross-tenant.
 */
@Injectable()
export class SuperuserGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!getRequestContext().superuser) throw AppError.forbidden();
    return true;
  }
}
