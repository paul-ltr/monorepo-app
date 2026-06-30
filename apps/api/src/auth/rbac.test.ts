import { describe, it, expect } from 'vitest';
import { AppError, type PermissionKey, type RequestContext } from '@pilotage/shared';
import { PermissionGuard } from './rbac';
import { requestContextStore } from '../common/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { generateOperatInput } from '@pilotage/shared';

function ctxWith(perms: PermissionKey[]): RequestContext {
  return {
    userId: 'u',
    tenantId: 't',
    email: 'e@x.fr',
    roles: ['manager'],
    permissions: perms,
    scope: { type: 'tenant' },
    locale: 'fr-FR',
  };
}

/** Fake Nest ExecutionContext + Reflector returning the required permissions. */
function execContext() {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}
function guardWith(required: PermissionKey[] | undefined) {
  const reflector = { getAllAndOverride: () => required } as never;
  return new PermissionGuard(reflector);
}

describe('PermissionGuard', () => {
  it('allows when no permission is required', () => {
    const guard = guardWith(undefined);
    expect(
      requestContextStore.run(ctxWith([]), () => guard.canActivate(execContext())),
    ).toBe(true);
  });

  it('allows when the context holds the required permission', () => {
    const guard = guardWith(['M2:reconcile']);
    expect(
      requestContextStore.run(ctxWith(['M2:reconcile']), () => guard.canActivate(execContext())),
    ).toBe(true);
  });

  it('forbids (403) when the permission is missing', () => {
    const guard = guardWith(['M2:reconcile']);
    requestContextStore.run(ctxWith(['M1:dashboard:view']), () => {
      try {
        guard.canActivate(execContext());
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).status).toBe(403);
      }
    });
  });
});

describe('ZodPipe', () => {
  it('passes valid input', () => {
    const pipe = new ZodPipe(generateOperatInput);
    expect(pipe.transform({ year: 2025 })).toEqual({ year: 2025 });
  });

  it('throws validation_failed (422) on invalid input', () => {
    const pipe = new ZodPipe(generateOperatInput);
    try {
      pipe.transform({ year: 'oops' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(422);
    }
  });
});
