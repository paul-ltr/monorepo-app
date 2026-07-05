import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@/config/env';

/**
 * Thin secret-storage seam. Connector tokens (e.g. an Electrolux refresh token)
 * are secrets: per ARCHITECTURE §connectors the DB only ever holds a `secret_ref`
 * (a Secrets Manager path) — never the token itself — so the data repo can read
 * the ref from `core.v_connector_config` and fetch the value from Secrets Manager
 * with its own AWS credentials.
 *
 * The default implementation here keeps values in-process (fine for the MVP /
 * single-instance dev, mirroring how the Pennylane/Enedis connectors currently
 * hold live tokens in memory). A production build swaps `put`/`get` for the AWS
 * SDK (`@aws-sdk/client-secrets-manager`) keyed by the same `ref()`; the public
 * contract — the `secret_ref` string — stays identical, so nothing else changes.
 */
@Injectable()
export class SecretStore {
  private readonly env = loadEnv();
  private readonly logger = new Logger(SecretStore.name);
  private readonly mem = new Map<string, string>();

  /** Deterministic Secrets Manager path for a connector secret. */
  ref(parts: { provider: string; tenantId: string; key: string }): string {
    const env = this.env.NODE_ENV || 'development';
    return `pilotage/${env}/${parts.provider}/${parts.tenantId}/${parts.key}`;
  }

  async put(ref: string, value: string): Promise<void> {
    this.mem.set(ref, value);
    this.logger.debug(`secret stored at ${ref} (in-memory; use Secrets Manager in prod)`);
  }

  async get(ref: string): Promise<string | null> {
    return this.mem.get(ref) ?? null;
  }

  async delete(ref: string): Promise<void> {
    this.mem.delete(ref);
  }
}
