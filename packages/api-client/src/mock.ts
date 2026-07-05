import {
  type Period,
  type SupportTicket,
  type TenantGroup,
  type AccountUser,
  type CreateSupportTicketInput,
  type ReplyTicketInput,
  type CreateAccountInput,
  type UpdateAccountInput,
  type Ticket,
  type CreateTicketInput,
  type Promotion,
  type CreatePromotionInput,
  type PromotionStatus,
  type Campaign,
  type CreateCampaignInput,
  type CampaignStatus,
  type Site,
  type SiteContact,
  type AppUser,
  type ConnectedMeter,
  type ConnectorHistory,
  type EnergyProvider,
  type ElectroluxAccount,
  type ElectroluxAppliance,
  type MieleAccount,
  type MieleAppliance,
  applyConnectorHistories,
  buildDailyHistory,
  buildStateDistribution,
  cleanDigits,
  isValidEnedisRef,
  lastNDays,
  simulatedPrm,
} from '@pilotage/shared';
import type { PilotageApi } from './types';
import * as f from './fixtures';

const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const uid = () =>
  `00000000-0000-7000-8000-${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}`;

/** In-browser mock implementing the full API from bundled fixtures. */
export function createMockClient(): PilotageApi {
  // Mutable copies so the back-office console reflects writes within a session.
  const tickets: SupportTicket[] = f.supportTickets.map((t) => ({ ...t, messages: [...t.messages] }));
  const groups: TenantGroup[] = f.tenantGroups.map((g) => ({ ...g }));
  const accounts: AccountUser[] = f.accounts.map((a) => ({ ...a }));
  const maintTickets: Ticket[] = f.maintenance.tickets.map((t) => ({ ...t }));
  const promotions: Promotion[] = f.pricing.promotions.map((p) => ({ ...p }));
  const campaigns: Campaign[] = f.customers.campaigns.map((c) => ({ ...c }));
  // Mutable copy so per-site SMS edits persist within a session.
  const sites: Site[] = f.sites.map((s) => ({ ...s }));
  // Per-site contact directory (email/phone), mutable within a session.
  const siteContacts: SiteContact[] = [
    { id: uid(), siteId: sites[0]!.id, kind: 'email', value: 'gerant.lyon3@exemple.fr', label: 'Gérant', isAlertRecipient: true },
    { id: uid(), siteId: sites[0]!.id, kind: 'phone', value: '+33 6 11 22 33 44', label: 'Astreinte', isAlertRecipient: false },
  ];
  // Tenant users, mutable within a session (invitations, role changes).
  const users: AppUser[] = [
    { id: uid(), tenantId: f.session.tenant.id, email: f.session.user.email, fullName: f.session.user.fullName, locale: 'fr-FR', status: 'active', lastLoginAt: new Date().toISOString(), roles: ['owner'] },
    { id: uid(), tenantId: f.session.tenant.id, email: 'manager@exemple.fr', fullName: 'Camille Martin', locale: 'fr-FR', status: 'active', lastLoginAt: null, roles: ['manager'] },
    { id: uid(), tenantId: f.session.tenant.id, email: 'compta@exemple.fr', fullName: 'Alex Dubois', locale: 'fr-FR', status: 'invited', lastLoginAt: null, roles: ['accountant'] },
  ];
  let seq = 1043;
  let maintSeq = 2242;

  const slaForPriority = (p: string) =>
    p === 'critical' ? 'SLA 1 h' : p === 'high' ? 'SLA 2 h' : p === 'medium' ? 'SLA 1 j' : 'SLA 3 j';

  // Simulated Pennylane connection state (no live OAuth in mock mode).
  let pennylane = { connected: false, company: null as string | null, expiresAt: null as string | null };

  // Simulated Electrolux OneApp/OCP state (no live login in mock mode).
  const elxAccounts: ElectroluxAccount[] = [];
  const elxAppliances: ElectroluxAppliance[] = [];
  const elxStatus = () => ({ accounts: [...elxAccounts], appliances: [...elxAppliances], simulated: true });

  // Simulated Miele state (no live OAuth in mock mode; the UI drives consent).
  const mielePending = new Map<string, { vg: string; label?: string }>();
  const mieleAccounts: MieleAccount[] = [];
  const mieleAppliances: MieleAppliance[] = [];
  const mieleStatusOf = () => ({ accounts: [...mieleAccounts], appliances: [...mieleAppliances], simulated: true });

  // Transient consent state for the simulated Enedis flow (state → prm + site).
  const enedisPending = new Map<string, { prm: string | null; siteId: string }>();
  // Connected meters, keyed by `${provider}:${siteId}`, feed the Énergie screen.
  const connected = new Map<string, ConnectedMeter>();

  const remember = (provider: EnergyProvider, siteId: string, history: ConnectorHistory) => {
    const site = f.sites.find((s) => s.id === siteId);
    connected.set(`${provider}:${siteId}`, {
      provider,
      siteId,
      siteName: site?.name ?? siteId,
      surfaceM2: site?.surfaceM2 ?? null,
      history,
    });
  };

  return {
    getSession: () => delay(f.session),
    getBranding: () => delay(f.branding),
    getDashboard: (_period: Period) => delay(f.dashboard),
    getMachineStatuses: () => delay(f.machineStatuses),
    getMachineStateDistribution: (period, siteId) => {
      const items = siteId
        ? f.machineStatuses.items.filter((m) => m.siteId === siteId)
        : f.machineStatuses.items;
      const counts = { free: 0, running: 0, finished: 0, out_of_service: 0, offline: 0 };
      for (const m of items) counts[m.state] += 1;
      return delay(buildStateDistribution(period, counts, siteId ?? 'fleet'));
    },
    getMachineDetail: (id: string) => delay(f.machineDetail(id)),
    getRevenue: (_period: Period) => delay(f.revenue),
    getEnergy: () => delay(applyConnectorHistories(f.energy, [...connected.values()])),
    generateOperat: (year: number) =>
      delay({
        id: '00000000-0000-7000-8000-0000000000ff',
        year,
        status: 'ready' as const,
        siteCount: 6,
        fileKey: `operat/${year}/dossier.pdf`,
        createdAt: '2026-06-29T08:00:00.000Z',
      }),
    getMaintenance: () => {
      const open = ['open', 'assigned', 'in_progress'];
      return delay({
        ...f.maintenance,
        tickets: maintTickets.map((t) => ({ ...t })),
        openTickets: maintTickets.filter((t) => open.includes(t.status)).length,
        criticalTickets: maintTickets.filter((t) => t.priority === 'critical' || t.priority === 'high').length,
      });
    },
    createMaintenanceTicket: (input: CreateTicketInput) => {
      const site = f.sites.find((s) => s.id === input.siteId);
      const machine = input.machineId
        ? f.machineStatuses.items.find((m) => m.machineId === input.machineId)
        : undefined;
      const priority = input.priority ?? 'medium';
      const ticket: Ticket = {
        id: uid(),
        code: `#${maintSeq++}`,
        title: input.title,
        siteId: input.siteId,
        siteName: site?.name ?? '—',
        machineCode: machine?.code ?? null,
        priority,
        status: 'open',
        source: input.source ?? 'operator',
        slaLabel: slaForPriority(priority),
        slaDueAt: null,
        openedAt: new Date().toISOString(),
      };
      maintTickets.unshift(ticket);
      return delay(ticket);
    },
    getPricing: () => delay({ ...f.pricing, promotions: promotions.map((p) => ({ ...p })) }),
    createPromotion: (input: CreatePromotionInput) => {
      const promo: Promotion = {
        id: uid(),
        label: input.label,
        scopeLabel: input.scopeLabel ?? 'Tous les sites',
        status: input.status ?? 'draft',
        type: input.type,
        value: input.value,
      };
      promotions.unshift(promo);
      return delay(promo);
    },
    setPromotionStatus: (id: string, status: PromotionStatus) => {
      const promo = promotions.find((p) => p.id === id);
      if (!promo) return Promise.reject(new Error('promotion not found'));
      promo.status = status;
      return delay({ ...promo });
    },
    getCustomers: () => delay({ ...f.customers, campaigns: campaigns.map((c) => ({ ...c })) }),
    createCampaign: (input: CreateCampaignInput) => {
      const campaign: Campaign = {
        id: uid(),
        label: input.label,
        channel: input.channel,
        status: input.status ?? 'draft',
        audienceLabel: input.audienceLabel || 'Audience à définir',
      };
      campaigns.unshift(campaign);
      return delay(campaign);
    },
    setCampaignStatus: (id: string, status: CampaignStatus) => {
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) return Promise.reject(new Error('campaign not found'));
      campaign.status = status;
      return delay({ ...campaign });
    },
    getFinance: () => delay(f.finance),
    getNetwork: () => delay(f.network),
    getAdmin: () => delay(f.admin),
    getNotifications: () => delay(f.notifications),
    getSites: () => delay(sites.map((s) => ({ ...s }))),
    updateSiteSms: (input) => {
      const site = sites.find((s) => s.id === input.siteId);
      if (!site) return Promise.reject(new Error('site not found'));
      site.smsNumber = input.smsNumber;
      return delay({ ...site });
    },
    createSite: (input) => {
      const site: Site = {
        id: uid(),
        tenantId: f.session.tenant.id,
        networkId: input.networkId ?? f.sites[0]!.networkId,
        name: input.name,
        address: input.address ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        surfaceM2: input.surfaceM2 ?? null,
        smsNumber: input.smsNumber ?? null,
        pdl: input.pdl ?? null,
        pce: input.pce ?? null,
        timezone: input.timezone ?? 'Europe/Paris',
        status: input.status ?? 'active',
        openedAt: input.openedAt ?? null,
      };
      sites.unshift(site);
      return delay({ ...site });
    },
    updateSite: (input) => {
      const site = sites.find((s) => s.id === input.siteId);
      if (!site) return Promise.reject(new Error('site not found'));
      Object.assign(site, input.patch);
      return delay({ ...site });
    },
    deleteSite: (id) => {
      const i = sites.findIndex((s) => s.id === id);
      if (i >= 0) sites.splice(i, 1);
      return delay({ ok: true as const });
    },
    getSiteContacts: (siteId) => delay(siteContacts.filter((c) => c.siteId === siteId).map((c) => ({ ...c }))),
    addSiteContact: (input) => {
      const contact: SiteContact = {
        id: uid(),
        siteId: input.siteId,
        kind: input.kind,
        value: input.value,
        label: input.label ?? null,
        isAlertRecipient: input.isAlertRecipient ?? false,
      };
      siteContacts.push(contact);
      return delay({ ...contact });
    },
    removeSiteContact: (_siteId, contactId) => {
      const i = siteContacts.findIndex((c) => c.id === contactId);
      if (i >= 0) siteContacts.splice(i, 1);
      return delay({ ok: true as const });
    },
    getUsers: () => delay(users.map((u) => ({ ...u }))),
    inviteUser: (input) => {
      const user: AppUser = {
        id: uid(),
        tenantId: f.session.tenant.id,
        email: input.email,
        fullName: input.fullName,
        locale: 'fr-FR',
        status: 'invited',
        lastLoginAt: null,
        roles: [...input.roleKeys],
      };
      users.unshift(user);
      return delay({ ...user });
    },
    updateUserRoles: (input) => {
      const user = users.find((u) => u.id === input.userId);
      if (!user) return Promise.reject(new Error('user not found'));
      user.roles = [...input.roleKeys];
      return delay({ ...user });
    },
    disableUser: (id) => {
      const user = users.find((u) => u.id === id);
      if (!user) return Promise.reject(new Error('user not found'));
      user.status = 'disabled';
      return delay({ ...user });
    },

    createSupportTicket: (input: CreateSupportTicketInput) => {
      const now = new Date().toISOString();
      const ticket: SupportTicket = {
        id: uid(),
        ref: `SUP-${seq++}`,
        subject: input.subject,
        groupId: f.session.tenant.id,
        groupName: f.session.tenant.name,
        requesterName: f.session.user.fullName,
        requesterEmail: f.session.user.email,
        status: 'open',
        priority: input.priority,
        category: input.category,
        createdAt: now,
        updatedAt: now,
        messages: [
          { id: uid(), authorName: f.session.user.fullName, authorRole: 'client', body: input.body, at: now },
        ],
      };
      tickets.unshift(ticket);
      return delay(ticket);
    },

    getSupportTickets: () => delay(tickets.map((t) => ({ ...t, messages: [...t.messages] }))),

    replySupportTicket: (input: ReplyTicketInput) => {
      const ticket = tickets.find((t) => t.id === input.ticketId);
      if (!ticket) return Promise.reject(new Error('ticket not found'));
      const now = new Date().toISOString();
      if (input.body) {
        ticket.messages = [
          ...ticket.messages,
          { id: uid(), authorName: 'Support LavoPilot', authorRole: 'staff', body: input.body, at: now },
        ];
      }
      if (input.status) ticket.status = input.status;
      ticket.updatedAt = now;
      return delay({ ...ticket, messages: [...ticket.messages] });
    },

    getTenantGroups: () => delay(groups.map((g) => ({ ...g }))),

    getAccounts: () => delay(accounts.map((a) => ({ ...a }))),

    createAccount: (input: CreateAccountInput) => {
      const group = groups.find((g) => g.id === input.groupId);
      const account: AccountUser = {
        id: uid(),
        groupId: input.groupId,
        groupName: group?.name ?? '—',
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        status: 'invited',
        lastActiveAt: null,
        createdAt: new Date().toISOString(),
      };
      accounts.unshift(account);
      if (group) group.usersCount += 1;
      return delay(account);
    },

    updateAccount: (input: UpdateAccountInput) => {
      const account = accounts.find((a) => a.id === input.id);
      if (!account) return Promise.reject(new Error('account not found'));
      if (input.role) account.role = input.role;
      if (input.status) account.status = input.status;
      return delay({ ...account });
    },

    enedisValidate: (input) => {
      if (input.mode === 'address') {
        const address = (input.address ?? '').replace(/\s+/g, ' ').trim();
        const valid = address.length >= 6;
        return delay({
          valid,
          prm: null,
          address: valid ? address : null,
          label: valid ? address : '',
          message: valid
            ? 'Adresse confirmée — le point de livraison sera identifié après consentement.'
            : 'Adresse trop courte pour être confirmée.',
        });
      }
      const prm = cleanDigits(input.prm ?? '');
      const valid = isValidEnedisRef(prm, input.kind);
      return delay({
        valid,
        prm: valid ? prm : null,
        address: null,
        label: valid ? `PRM ${prm.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}` : '',
        message: valid
          ? 'Numéro valide — prêt pour la demande de consentement Enedis.'
          : input.kind === 'pdl'
            ? 'Le PDL/PRM doit comporter exactement 14 chiffres.'
            : 'Référence C4 invalide (6 à 20 caractères).',
      });
    },
    enedisAuthorize: (input) => {
      const state = `mock-${Math.random().toString(36).slice(2, 10)}`;
      enedisPending.set(state, { prm: input.prm ? cleanDigits(input.prm) : null, siteId: input.siteId });
      // No live Enedis in mock mode → the wizard drives the simulated consent.
      return delay({ authorizeUrl: `#enedis-consent/${state}`, state, simulated: true });
    },
    enedisComplete: (input) => {
      const pending = enedisPending.get(input.state);
      if (!pending) {
        return delay({
          status: 'error' as const,
          usagePointId: '',
          message: 'Consentement introuvable ou expiré. Relancez la connexion.',
          history: null,
        });
      }
      enedisPending.delete(input.state);
      const usagePointId = pending.prm ?? simulatedPrm(input.state);
      const { from, to } = lastNDays(30);
      const history = { ...buildDailyHistory('enedis', usagePointId, from, to, 18, 6), simulated: true };
      remember('enedis', pending.siteId, history);
      return delay({
        status: 'connected' as const,
        usagePointId,
        message: `Connexion Enedis établie — ${history.points.length} jours importés.`,
        history,
      });
    },
    grdfTest: (input) => {
      const pce = cleanDigits(input.pce);
      const ok = /^\d{14}$/.test(pce);
      return delay({
        ok,
        pce,
        tokenObtained: ok,
        message: ok
          ? 'Connexion GRDF ADICT établie — PCE reconnu (bac à sable).'
          : 'Le PCE doit comporter 14 chiffres.',
        simulated: true,
      });
    },
    grdfHistory: (input) => {
      const pce = cleanDigits(input.pce);
      const { from, to } = lastNDays(30);
      const history = { ...buildDailyHistory('grdf', pce, from, to, 42, 12), simulated: true };
      remember('grdf', input.siteId, history);
      return delay(history);
    },

    pennylaneStatus: () =>
      delay({ connected: pennylane.connected, company: pennylane.company, simulated: true, expiresAt: pennylane.expiresAt }),
    pennylaneAuthorize: () => {
      const state = `pl-mock-${Math.random().toString(36).slice(2, 10)}`;
      // No live Pennylane in mock mode → the UI drives the simulated consent.
      return delay({ authorizeUrl: `#pennylane-consent/${state}`, state, simulated: true });
    },
    pennylaneComplete: () => {
      const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
      pennylane = { connected: true, company: f.session.tenant.name, expiresAt };
      return delay({
        status: 'connected' as const,
        company: pennylane.company,
        message: `Pennylane connecté — société « ${pennylane.company} ».`,
        simulated: true,
        expiresAt,
      });
    },
    pennylaneDisconnect: () => {
      pennylane = { connected: false, company: null, expiresAt: null };
      return delay({ connected: false, company: null, simulated: true, expiresAt: null });
    },

    electroluxStatus: () => delay(elxStatus()),
    electroluxConnect: (input) => {
      const accountId = uid();
      const brand = input.brand ?? 'electrolux';
      const account: ElectroluxAccount = {
        id: accountId,
        label: input.label?.trim() || (input.email ? input.email : `Compte ${brand} (démo)`),
        brand,
        countryCode: input.countryCode ?? 'FR',
        applianceCount: 3,
        simulated: true,
        connectedAt: new Date().toISOString(),
      };
      const demo: Array<[string, string, string, string]> = [
        ['950011538000123', 'Lave-linge Pro WD6', 'WASHING_MACHINE', 'WD6-8'],
        ['950011538000124', 'Sèche-linge Pro TD6', 'TUMBLE_DRYER', 'TD6-14'],
        ['950011538000125', 'Lave-linge Pro WD6', 'WASHING_MACHINE', 'WD6-10'],
      ];
      const appliances: ElectroluxAppliance[] = demo.map(([id, name, type, model]) => ({
        applianceId: `${accountId}-${id}`,
        name,
        type,
        model,
        serial: id,
        connected: true,
        accountId,
        siteId: null,
        siteName: null,
        machineId: null,
      }));
      elxAccounts.push(account);
      elxAppliances.push(...appliances);
      return delay({
        status: 'connected' as const,
        account,
        appliances,
        message: `Compte Electrolux connecté (simulation) — ${appliances.length} appareils.`,
        simulated: true,
      });
    },
    electroluxAssociate: (input) => {
      const appliance = elxAppliances.find(
        (a) => a.applianceId === input.applianceId && a.accountId === input.accountId,
      );
      if (appliance) {
        appliance.siteId = input.siteId;
        appliance.siteName = sites.find((s) => s.id === input.siteId)?.name ?? null;
        appliance.machineId = uid();
      }
      return delay(elxStatus());
    },
    electroluxDisconnect: (input) => {
      const i = elxAccounts.findIndex((a) => a.id === input.accountId);
      if (i >= 0) elxAccounts.splice(i, 1);
      for (let j = elxAppliances.length - 1; j >= 0; j--)
        if (elxAppliances[j]!.accountId === input.accountId) elxAppliances.splice(j, 1);
      return delay(elxStatus());
    },

    mieleStatus: () => delay(mieleStatusOf()),
    mieleAuthorize: (input) => {
      const state = `miele-mock-${Math.random().toString(36).slice(2, 10)}`;
      mielePending.set(state, { vg: input.vg ?? 'fr-FR', label: input.label });
      // No live Miele in mock mode → the UI drives the simulated consent in-app.
      return delay({ authorizeUrl: `#miele-consent/${state}`, state, simulated: true });
    },
    mieleComplete: (input) => {
      const pending = mielePending.get(input.state);
      if (!pending) {
        return delay({
          status: 'error' as const,
          account: null,
          appliances: [],
          message: 'Consentement introuvable ou expiré. Relancez la connexion.',
          simulated: true,
        });
      }
      mielePending.delete(input.state);
      const accountId = uid();
      const account: MieleAccount = {
        id: accountId,
        label: pending.label?.trim() || `Compte Miele ${pending.vg}`,
        vg: pending.vg,
        applianceCount: 3,
        simulated: true,
        connectedAt: new Date().toISOString(),
      };
      const demo: Array<[string, string, string, string]> = [
        ['000160212345', 'Lave-linge Miele PWM', 'Washing machine', 'PWM 507'],
        ['000160212346', 'Sèche-linge Miele PDR', 'Tumble dryer', 'PDR 507'],
        ['000160212347', 'Lave-linge séchant Miele', 'Washer dryer', 'WTR 870'],
      ];
      const appliances: MieleAppliance[] = demo.map(([id, name, type, model]) => ({
        applianceId: `${accountId}-${id}`,
        name,
        type,
        model,
        serial: id,
        connected: true,
        accountId,
        siteId: null,
        siteName: null,
        machineId: null,
      }));
      mieleAccounts.push(account);
      mieleAppliances.push(...appliances);
      return delay({
        status: 'connected' as const,
        account,
        appliances,
        message: `Compte Miele connecté (simulation) — ${appliances.length} appareils.`,
        simulated: true,
      });
    },
    mieleAssociate: (input) => {
      const appliance = mieleAppliances.find(
        (a) => a.applianceId === input.applianceId && a.accountId === input.accountId,
      );
      if (appliance) {
        appliance.siteId = input.siteId;
        appliance.siteName = sites.find((s) => s.id === input.siteId)?.name ?? null;
        appliance.machineId = uid();
      }
      return delay(mieleStatusOf());
    },
    mieleDisconnect: (input) => {
      const i = mieleAccounts.findIndex((a) => a.id === input.accountId);
      if (i >= 0) mieleAccounts.splice(i, 1);
      for (let j = mieleAppliances.length - 1; j >= 0; j--)
        if (mieleAppliances[j]!.accountId === input.accountId) mieleAppliances.splice(j, 1);
      return delay(mieleStatusOf());
    },
  };
}
