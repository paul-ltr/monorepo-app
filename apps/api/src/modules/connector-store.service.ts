import { Injectable } from '@nestjs/common';
import { fixtures } from '@pilotage/api-client';
import type { ConnectedMeter, ConnectorHistory, EnergyProvider } from '@pilotage/shared';

/**
 * In-memory cache of the latest first-history pulled per (tenant, provider,
 * site). `core.connector_config` is the durable record; this holds the full
 * curve so ReadService can overlay live Enedis/GRDF data onto the Énergie /
 * OPERAT summary without a round-trip to the (future) data repo. Single-instance
 * scope is fine for the MVP — the data repo becomes the source of truth later.
 */
@Injectable()
export class ConnectorStore {
  private readonly byTenant = new Map<string, Map<string, ConnectedMeter>>();

  put(tenantId: string, provider: EnergyProvider, siteId: string, history: ConnectorHistory): void {
    const site = fixtures.sites.find((s) => s.id === siteId);
    const tenant = this.byTenant.get(tenantId) ?? new Map<string, ConnectedMeter>();
    tenant.set(`${provider}:${siteId}`, {
      provider,
      siteId,
      siteName: site?.name ?? siteId,
      surfaceM2: site?.surfaceM2 ?? null,
      history,
    });
    this.byTenant.set(tenantId, tenant);
  }

  list(tenantId: string): ConnectedMeter[] {
    return [...(this.byTenant.get(tenantId)?.values() ?? [])];
  }
}
