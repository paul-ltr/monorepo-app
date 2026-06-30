import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, hasPermission, type PermissionKey, type RequestContext } from '@pilotage/shared';
import { getRequestContext } from '@/common/request-context';

export const PERMISSION_KEY = 'pilotage:permission';

/** Route decorator: require a permission from the RBAC catalog. */
export const RequirePermission = (...keys: PermissionKey[]) => SetMetadata(PERMISSION_KEY, keys);

/** Param decorator: inject the resolved request context into a handler. */
export const Ctx = createParamDecorator((_data: unknown, _host: ExecutionContext): RequestContext => {
  return getRequestContext();
});

/** Enforces @RequirePermission against the active request context. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const ctx = getRequestContext();
    const ok = required.every((key) => hasPermission(ctx, key));
    if (!ok) throw AppError.forbidden();
    return true;
  }
}
