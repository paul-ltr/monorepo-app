import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { createDb, withTenantContext, type Database } from '@pilotage/db';
import { loadEnv } from '@/config/env';
import { getRequestContext } from '@/common/request-context';

export const DATABASE = 'DATABASE';

/**
 * Runs a callback inside a transaction with the RLS GUCs (app.current_tenant /
 * app.current_user) set from the active request context, so every `core` query
 * is tenant-filtered by PostgreSQL Row-Level Security.
 */
@Injectable()
export class ScopedDb {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  run<T>(fn: (tx: Parameters<Parameters<typeof withTenantContext<T>>[2]>[0]) => Promise<T>): Promise<T> {
    const ctx = getRequestContext();
    return withTenantContext(
      this.db,
      { tenantId: ctx.tenantId, userId: ctx.userId, role: loadEnv().DATABASE_APP_ROLE },
      fn,
    );
  }

  /**
   * Run scoped to an *explicit* tenant rather than the request's own — for the
   * superuser back-office, whose writes target other tenants' rows. RLS still
   * applies (the write is scoped to that tenant), so only a superuser-guarded
   * controller should reach this.
   */
  runAs<T>(
    tenantId: string,
    fn: (tx: Parameters<Parameters<typeof withTenantContext<T>>[2]>[0]) => Promise<T>,
  ): Promise<T> {
    const ctx = getRequestContext();
    return withTenantContext(
      this.db,
      { tenantId, userId: ctx.userId, role: loadEnv().DATABASE_APP_ROLE },
      fn,
    );
  }

  /** Raw client — non-tenant-scoped, for cross-tenant `core.v_*` view reads. */
  get raw(): Database {
    return this.db;
  }
}

/** Provides the Drizzle client and the tenant-scoped query runner. */
@Global()
@Module({
  providers: [
    { provide: DATABASE, useFactory: (): Database => createDb(loadEnv().DATABASE_URL, { max: 5 }) },
    ScopedDb,
  ],
  exports: [DATABASE, ScopedDb],
})
export class DbModule {}
