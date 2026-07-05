import type {
  Period,
  TenantBranding,
  DashboardSummary,
  MachineStatus,
  MachineStateCounts,
  MachineStateDistribution,
  MachineDistPeriod,
  MachineDetail,
  DataFreshness,
  RevenueSummary,
  EnergySummary,
  OperatReport,
  MaintenanceSummary,
  PricingSummary,
  Promotion,
  CreatePromotionInput,
  PromotionStatus,
  CustomersSummary,
  Campaign,
  CreateCampaignInput,
  CampaignStatus,
  FinanceSummary,
  NetworkSummary,
  AdminSummary,
  NotificationList,
  Site,
  UpdateSiteSmsInput,
  PermissionKey,
  SupportTicket,
  CreateSupportTicketInput,
  ReplyTicketInput,
  Ticket,
  CreateTicketInput,
  TenantGroup,
  AccountUser,
  CreateAccountInput,
  UpdateAccountInput,
  EnedisValidateInput,
  EnedisValidateResult,
  EnedisAuthorizeInput,
  EnedisAuthorizeResult,
  EnedisCompleteInput,
  EnedisCompleteResult,
  GrdfTestInput,
  GrdfTestResult,
  GrdfHistoryInput,
  ConnectorHistory,
  PennylaneStatus,
  PennylaneAuthorizeResult,
  PennylaneCompleteInput,
  PennylaneCompleteResult,
  BridgeStatus,
  BridgeAuthorizeResult,
  BridgeCompleteInput,
  BridgeCompleteResult,
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
  /** LavoPilot staff — unlocks the back-office console. */
  superuser: boolean;
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
  getMachineStateDistribution(
    period: MachineDistPeriod,
    siteId?: string,
  ): Promise<MachineStateDistribution>;
  getMachineDetail(id: string): Promise<MachineDetail>;
  getRevenue(period: Period): Promise<RevenueSummary>;
  getEnergy(): Promise<EnergySummary>;
  generateOperat(year: number): Promise<OperatReport>;
  getMaintenance(): Promise<MaintenanceSummary>;
  createMaintenanceTicket(input: CreateTicketInput): Promise<Ticket>;
  getPricing(): Promise<PricingSummary>;
  createPromotion(input: CreatePromotionInput): Promise<Promotion>;
  setPromotionStatus(id: string, status: PromotionStatus): Promise<Promotion>;
  getCustomers(): Promise<CustomersSummary>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  setCampaignStatus(id: string, status: CampaignStatus): Promise<Campaign>;
  getFinance(): Promise<FinanceSummary>;
  getNetwork(): Promise<NetworkSummary>;
  getAdmin(): Promise<AdminSummary>;
  getNotifications(): Promise<NotificationList>;
  getSites(): Promise<Site[]>;
  /** Set/clear a site's SMS alert recipient (M12:sites:manage). */
  updateSiteSms(input: UpdateSiteSmsInput): Promise<Site>;

  // Support widget — open to any authenticated user.
  createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicket>;

  // Back-office console — superuser (LavoPilot staff) only.
  getSupportTickets(): Promise<SupportTicket[]>;
  replySupportTicket(input: ReplyTicketInput): Promise<SupportTicket>;
  getTenantGroups(): Promise<TenantGroup[]>;
  getAccounts(): Promise<AccountUser[]>;
  createAccount(input: CreateAccountInput): Promise<AccountUser>;
  updateAccount(input: UpdateAccountInput): Promise<AccountUser>;

  // Energy connectors (M5/M12) — Enedis Data Connect & GRDF ADICT onboarding.
  enedisValidate(input: EnedisValidateInput): Promise<EnedisValidateResult>;
  enedisAuthorize(input: EnedisAuthorizeInput): Promise<EnedisAuthorizeResult>;
  enedisComplete(input: EnedisCompleteInput): Promise<EnedisCompleteResult>;
  grdfTest(input: GrdfTestInput): Promise<GrdfTestResult>;
  grdfHistory(input: GrdfHistoryInput): Promise<ConnectorHistory>;

  // Accounting connector (M6) — Pennylane OAuth 2.0.
  pennylaneStatus(): Promise<PennylaneStatus>;
  pennylaneAuthorize(): Promise<PennylaneAuthorizeResult>;
  pennylaneComplete(input: PennylaneCompleteInput): Promise<PennylaneCompleteResult>;
  pennylaneDisconnect(): Promise<PennylaneStatus>;

  // Open-banking connector (M6) — Bridge by Bankin' (agrégation bancaire DSP2).
  bridgeStatus(): Promise<BridgeStatus>;
  bridgeAuthorize(): Promise<BridgeAuthorizeResult>;
  bridgeComplete(input: BridgeCompleteInput): Promise<BridgeCompleteResult>;
  bridgeDisconnect(): Promise<BridgeStatus>;
}
