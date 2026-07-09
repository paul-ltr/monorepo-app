import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createDb, withTenantContext, type Database } from '@pilotage/db';
import { loadEnv } from '@/config/env';
import { getRequestContext } from '@/common/request-context';

export const DATABASE = 'DATABASE';

/**
 * Build the connection string. In AWS the DB is a private RDS Proxy with the
 * master credentials in Secrets Manager: when `DB_PROXY_ENDPOINT` +
 * `DB_SECRET_ARN` are set we fetch the secret and assemble the URL (TLS
 * required by the proxy), so the password never lives in the Lambda env. Locally
 * (neither set) we use `DATABASE_URL`.
 */
async function resolveDatabaseUrl(): Promise<string> {
  const env = loadEnv();
  if (!env.DB_PROXY_ENDPOINT || !env.DB_SECRET_ARN) return env.DATABASE_URL;
  const sm = new SecretsManagerClient({ region: env.AWS_REGION ?? env.COGNITO_REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: env.DB_SECRET_ARN }));
  const s = JSON.parse(res.SecretString ?? '{}') as { username: string; password: string; dbname?: string };
  const user = encodeURIComponent(s.username);
  const pass = encodeURIComponent(s.password);
  return `postgresql://${user}:${pass}@${env.DB_PROXY_ENDPOINT}:5432/${s.dbname ?? 'pilotage'}?sslmode=require`;
}

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
    { provide: DATABASE, useFactory: async (): Promise<Database> => createDb(await resolveDatabaseUrl(), { max: 5 }) },
    ScopedDb,
  ],
  exports: [DATABASE, ScopedDb],
})
export class DbModule {}
