import { Injectable, Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { loadEnv } from '@/config/env';

/**
 * Thin secret-storage seam. Connector tokens (e.g. an Electrolux refresh token)
 * are secrets: per ARCHITECTURE §connectors the DB only ever holds a `secret_ref`
 * (a Secrets Manager path) — never the token itself — so the data repo can read
 * the ref from `core.v_connector_config` and fetch the value from Secrets Manager
 * with its own AWS credentials.
 *
 * In development (`NODE_ENV=development`) values are kept in-process (fine for
 * single-instance dev, mirroring how the Pennylane/Enedis connectors hold live
 * tokens in memory). Outside dev the same `ref()` keys are backed by AWS Secrets
 * Manager; the public contract — the `secret_ref` string — stays identical.
 */
@Injectable()
export class SecretStore {
  private readonly env = loadEnv();
  private readonly logger = new Logger(SecretStore.name);
  private readonly mem = new Map<string, string>();
  private readonly cache = new Map<string, { value: string; expiresAt: number }>();
  // In-memory for local dev and tests; real Secrets Manager in staging/prod.
  private readonly useAws = !['development', 'test'].includes(this.env.NODE_ENV);
  private client: SecretsManagerClient | null = null;

  private aws(): SecretsManagerClient {
    this.client ??= new SecretsManagerClient({
      region: this.env.AWS_REGION ?? this.env.COGNITO_REGION,
    });
    return this.client;
  }

  /** Deterministic Secrets Manager path for a tenant-scoped connector secret. */
  ref(parts: { provider: string; tenantId: string; key: string }): string {
    const env = this.env.NODE_ENV || 'development';
    return `pilotage/${env}/${parts.provider}/${parts.tenantId}/${parts.key}`;
  }

  /** Path for a non-tenant-scoped (global) secret, e.g. the shared Brevo key. */
  globalRef(parts: { provider: string; key: string }): string {
    const env = this.env.NODE_ENV || 'development';
    return `pilotage/${env}/${parts.provider}/${parts.key}`;
  }

  async put(ref: string, value: string): Promise<void> {
    this.cache.delete(ref);
    if (!this.useAws) {
      this.mem.set(ref, value);
      this.logger.debug(`secret stored at ${ref} (in-memory; use Secrets Manager in prod)`);
      return;
    }
    try {
      await this.aws().send(new PutSecretValueCommand({ SecretId: ref, SecretString: value }));
    } catch (err) {
      if ((err as { name?: string })?.name === 'ResourceNotFoundException') {
        await this.aws().send(new CreateSecretCommand({ Name: ref, SecretString: value }));
      } else {
        throw err;
      }
    }
  }

  async get(ref: string): Promise<string | null> {
    if (!this.useAws) return this.mem.get(ref) ?? null;
    try {
      const res = await this.aws().send(new GetSecretValueCommand({ SecretId: ref }));
      return res.SecretString ?? null;
    } catch (err) {
      if ((err as { name?: string })?.name === 'ResourceNotFoundException') return null;
      throw err;
    }
  }

  /** Like `get`, but memoised in-process for `ttlMs` to avoid a call per read. */
  async getCached(ref: string, ttlMs = 5 * 60_000): Promise<string | null> {
    const now = Date.now();
    const hit = this.cache.get(ref);
    if (hit && hit.expiresAt > now) return hit.value;
    const value = await this.get(ref);
    if (value !== null) this.cache.set(ref, { value, expiresAt: now + ttlMs });
    return value;
  }

  async delete(ref: string): Promise<void> {
    this.cache.delete(ref);
    if (!this.useAws) {
      this.mem.delete(ref);
      return;
    }
    try {
      await this.aws().send(new DeleteSecretCommand({ SecretId: ref, ForceDeleteWithoutRecovery: true }));
    } catch (err) {
      if ((err as { name?: string })?.name !== 'ResourceNotFoundException') throw err;
    }
  }
}
