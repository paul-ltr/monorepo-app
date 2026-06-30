import { Injectable } from '@nestjs/common';
import { fixtures } from '@pilotage/api-client';
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
  OperatReport,
} from '@pilotage/shared';
import type { MachineStatusList } from '@pilotage/api-client';

/**
 * Read models for the dashboards. These are *derived* data that the data repo
 * will compute into `ingest`/`analytics`. Until that repo exists, the spec says
 * to mock those tables locally — so we serve the typed demo fixtures (identical
 * shapes to the contract). Swap each method for a query against
 * `analytics.*` / `ingest.*` (via ScopedDb) when the data repo is wired.
 */
@Injectable()
export class ReadService {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRevenue(_period: Period): RevenueSummary {
    return fixtures.revenue;
  }
  getEnergy(): EnergySummary {
    return fixtures.energy;
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
