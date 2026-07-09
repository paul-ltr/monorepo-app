import { Injectable } from '@nestjs/common';
import { fixtures } from '@pilotage/api-client';
import { applyConnectorHistories, buildStateDistribution } from '@pilotage/shared';
import type {
  Period,
  DashboardSummary,
  RevenueSummary,
  EnergySummary,
  MaintenanceSummary,
  PricingSummary,
  CustomersSummary,
  FinanceSummary,
  NetworkSummary,
  AdminSummary,
  NotificationList,
  MachineDetail,
  MachineDistPeriod,
  MachineStateCounts,
  MachineStateDistribution,
  OperatReport,
} from '@pilotage/shared';
import type { MachineStatusList } from '@pilotage/api-client';
import { ConnectorStore } from './connector-store.service';

/**
 * Read models for the dashboards. These are *derived* data that the data repo
 * will compute into `ingest`/`analytics`. Until that repo exists, the spec says
 * to mock those tables locally — so we serve the typed demo fixtures (identical
 * shapes to the contract). Swap each method for a query against
 * `analytics.*` / `ingest.*` (via ScopedDb) when the data repo is wired.
 */
@Injectable()
export class ReadService {
  constructor(private readonly connectors: ConnectorStore) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDashboard(_period: Period): DashboardSummary {
    return fixtures.dashboard;
  }
  getMachineStatuses(): MachineStatusList {
    return fixtures.machineStatuses;
  }
  getMachineDetail(id: string): MachineDetail {
    return fixtures.machineDetail(id);
  }
  /** Daily state repartition + average shares over the window (mirrors the mock). */
  getMachineStateDistribution(period: MachineDistPeriod, siteId?: string): MachineStateDistribution {
    const items = siteId
      ? fixtures.machineStatuses.items.filter((m) => m.siteId === siteId)
      : fixtures.machineStatuses.items;
    const counts: MachineStateCounts = { free: 0, running: 0, finished: 0, out_of_service: 0, offline: 0 };
    for (const m of items) counts[m.state] += 1;
    return buildStateDistribution(period, counts, siteId ?? 'fleet');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRevenue(_period: Period): RevenueSummary {
    return fixtures.revenue;
  }
  /** Base Énergie/OPERAT read model, overlaid with any live connector data. */
  getEnergy(tenantId: string): EnergySummary {
    return applyConnectorHistories(fixtures.energy, this.connectors.list(tenantId));
  }
  getMaintenance(): MaintenanceSummary {
    return fixtures.maintenance;
  }
  getPricing(): PricingSummary {
    return fixtures.pricing;
  }
  getCustomers(): CustomersSummary {
    return fixtures.customers;
  }
  getFinance(): FinanceSummary {
    return fixtures.finance;
  }
  getNetwork(): NetworkSummary {
    return fixtures.network;
  }
  getAdmin(): AdminSummary {
    return fixtures.admin;
  }
  getNotifications(): NotificationList {
    return fixtures.notifications;
  }

  /** M5 OPERAT dossier generation — enqueues a build and returns its handle. */
  generateOperat(year: number): OperatReport {
    return {
      id: '00000000-0000-7000-8000-0000000000ff',
      year,
      status: 'ready',
      siteCount: fixtures.sites.length,
      fileKey: `operat/${year}/dossier.pdf`,
      createdAt: new Date().toISOString(),
    };
  }
}
