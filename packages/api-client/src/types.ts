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
  CreateSiteInput,
  UpdateSiteInput,
  SiteContact,
  SiteContactInput,
  AppUser,
  InviteUserInput,
  UpdateUserRolesInput,
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
  ElectroluxConnectInput,
  ElectroluxConnectResult,
  ElectroluxStatus,
  ElectroluxAssociateInput,
  ElectroluxDisconnectInput,
  MieleAuthorizeInput,
  MieleAuthorizeResult,
  MieleCompleteInput,
  MieleCompleteResult,
  MieleStatus,
  MieleAssociateInput,
  MieleDisconnectInput,
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
  /** Create a new site (M12:sites:manage). */
  createSite(input: CreateSiteInput): Promise<Site>;
  /** Auto-save partial edits to a site (M12:sites:manage). */
  updateSite(input: UpdateSiteInput): Promise<Site>;
  /** Soft-delete a site (M12:sites:manage). */
  deleteSite(id: string): Promise<{ ok: true }>;
  /** Email/phone contact directory for a site. */
  getSiteContacts(siteId: string): Promise<SiteContact[]>;
  addSiteContact(input: SiteContactInput): Promise<SiteContact>;
  removeSiteContact(siteId: string, contactId: string): Promise<{ ok: true }>;

  // Tenant user management (M12:users:manage) — super admins & network admins.
  getUsers(): Promise<AppUser[]>;
  inviteUser(input: InviteUserInput): Promise<AppUser>;
  updateUserRoles(input: UpdateUserRolesInput): Promise<AppUser>;
  disableUser(id: string): Promise<AppUser>;

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

  // Machine-brand connector (M1/M12) — Electrolux OneApp/OCP account onboarding.
  electroluxStatus(): Promise<ElectroluxStatus>;
  electroluxConnect(input: ElectroluxConnectInput): Promise<ElectroluxConnectResult>;
  electroluxAssociate(input: ElectroluxAssociateInput): Promise<ElectroluxStatus>;
  electroluxDisconnect(input: ElectroluxDisconnectInput): Promise<ElectroluxStatus>;

  // Machine-brand connector (M1/M12) — Miele 3rd Party API (OAuth 2.0 redirect).
  mieleStatus(): Promise<MieleStatus>;
  mieleAuthorize(input: MieleAuthorizeInput): Promise<MieleAuthorizeResult>;
  mieleComplete(input: MieleCompleteInput): Promise<MieleCompleteResult>;
  mieleAssociate(input: MieleAssociateInput): Promise<MieleStatus>;
  mieleDisconnect(input: MieleDisconnectInput): Promise<MieleStatus>;
}
