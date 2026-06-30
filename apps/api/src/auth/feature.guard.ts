import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, isModuleEnabled, parseFeatureFlags, type ModuleKey } from '@pilotage/shared';
import { loadEnv } from '@/config/env';

export const MODULE_META = 'pilotage:module';

/** Route/controller decorator: gate behind a domain module's feature flag. */
export const RequireModule = (module: ModuleKey) => SetMetadata(MODULE_META, module);

/**
 * Returns 501 feature_disabled for endpoints of a module that is flagged off
 * (Should/Could modules in the MVP). Resolution: module default → env override
 * (FEATURE_FLAGS). Per-tenant overrides would layer on here.
 */
@Injectable()
export class FeatureModuleGuard implements CanActivate {
  private readonly overrides = parseFeatureFlags(loadEnv().FEATURE_FLAGS);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const mod = this.reflector.getAllAndOverride<ModuleKey | undefined>(MODULE_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!mod) return true;
    if (!isModuleEnabled(mod, this.overrides)) throw AppError.featureDisabled(mod);
    return true;
  }
}
