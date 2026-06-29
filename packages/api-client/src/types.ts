import type {
  Period,
  TenantBranding,
  DashboardSummary,
  MachineStatus,
  MachineStateCounts,
  MachineDetail,
  DataFreshness,
  RevenueSummary,
  EnergySummary,
  OperatReport,
  MaintenanceSummary,
  PricingSummary,
  CustomersSummary,
  FinanceSummary,
  NetworkSummary,
  AdminSummary,
  NotificationList,
  Site,
  PermissionKey,
} from '@pilotage/shared';

export interface MachineStatusList {
  items: MachineStatus[];
  counts: MachineStateCounts;
  freshness: DataFreshness;
}

export interface SessionInfo {
  user: { id: string; email: string; fullName: string };
  tenant: { id: string; name: string };
  roles: string[];
  permissions: PermissionKey[];
}

/**
 * The API surface consumed by the web app. The HTTP client calls the NestJS
 * backend; the mock client returns bundled fixtures so every screen renders
 * before/without the backend.
 */
export interface PilotageApi {
  getSession(): Promise<SessionInfo>;
  getBranding(): Promise<TenantBranding>;
  getDashboard(period: Period): Promise<DashboardSummary>;
  getMachineStatuses(): Promise<MachineStatusList>;
  getMachineDetail(id: string): Promise<MachineDetail>;
  getRevenue(period: Period): Promise<RevenueSummary>;
  getEnergy(): Promise<EnergySummary>;
  generateOperat(year: number): Promise<OperatReport>;
  getMaintenance(): Promise<MaintenanceSummary>;
  getPricing(): Promise<PricingSummary>;
  getCustomers(): Promise<CustomersSummary>;
  getFinance(): Promise<FinanceSummary>;
  getNetwork(): Promise<NetworkSummary>;
  getAdmin(): Promise<AdminSummary>;
  getNotifications(): Promise<NotificationList>;
  getSites(): Promise<Site[]>;
}
