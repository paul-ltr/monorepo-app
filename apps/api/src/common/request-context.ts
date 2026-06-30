import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from '@pilotage/shared';

/**
 * Per-request identity propagated via AsyncLocalStorage so services (and the DB
 * layer setting the RLS GUCs) can read the active tenant/user/scope without
 * threading it through every call. Populated by AuthGuard.
 */
export const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContextStore.getStore();
  if (!ctx) throw new Error('No request context — AuthGuard did not run');
  return ctx;
}

export function getRequestContextOrNull(): RequestContext | null {
  return requestContextStore.getStore() ?? null;
}
