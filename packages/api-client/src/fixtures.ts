/**
 * Demo data mirroring the Claude Design handoff ("Pilotage — Console opérateur").
 * Typed with @pilotage/shared so the mock client and the web stay in contract.
 * Money is integer cents. Used by the mock client and as a reference for the
 * API's analytics-derived read models until the data repo is wired.
 */
import type {
  Money,
  TenantBranding,
  DashboardSummary,
  MachineStatus,
  MachineStateCounts,
  MachineDetail,
  RevenueSummary,
  EnergySummary,
  MaintenanceSummary,
  PricingSummary,
  CustomersSummary,
  FinanceSummary,
  NetworkSummary,
  AdminSummary,
  NotificationList,
  Site,
  SupportTicket,
  TenantGroup,
  AccountUser,
} from '@pilotage/shared';
import type { MachineStatusList, SessionInfo } from './types';

const e = (amountCents: number): Money => ({ amountCents, currency: 'EUR' });
const NOW = '2026-06-29T08:00:00.000Z';
const u = (n: string) => `00000000-0000-7000-8000-${n.padStart(12, '0')}`;

export const branding: TenantBranding = {
  tenantId: u('1'),
  appName: 'LavoPilot',
  logoUrl: null,
  primaryColor: '#1B4DB3',
};

export const session: SessionInfo = {
  user: { id: u('10'), email: 'demo@laveo.fr', fullName: 'Sophie Diallo' },
  tenant: { id: u('1'), name: 'Groupe Lavomatique' },
  roles: ['owner'],
  superuser: true, // demo: LavoPilot staff — unlocks the back-office console
  permissions: [
    'M1:dashboard:view',
    'M1:machines:view',
    'M1:machines:command',
    'M2:revenue:view',
    'M2:reconcile',
    'M2:refund:approve',
    'M4:maintenance:view',
    'M4:ticket:write',
    'M5:energy:view',
    'M5:operat:generate',
    'M6:finance:view',
    'M6:fec:export',
    'M7:pricing:view',
    'M7:pricing:write',
    'M3:customers:view',
    'M9:network:view',
    'M12:users:manage',
    'M12:connectors:manage',
    'M12:audit:view',
    'M12:billing:manage',
  ],
};

export const sites: Site[] = (
  [
    ['Lyon-3 Guillotière', '14 cours Gambetta', 'Lyon', '69003', 220, 45.7538, 4.8494, '2021-03-15', 'active'],
    ['Paris-11 Voltaire', '92 boulevard Voltaire', 'Paris', '75011', 180, 48.8583, 2.3796, '2022-06-01', 'active'],
    ['Villeurbanne Gratte-Ciel', '8 avenue Henri Barbusse', 'Villeurbanne', '69100', 160, 45.7719, 4.8795, '2022-09-12', 'active'],
    ['Lyon-7 Jean Macé', '31 rue de Marseille', 'Lyon', '69007', 140, 45.7448, 4.8422, '2023-01-20', 'active'],
    ['Vénissieux Centre', '5 place Léon Sublet', 'Vénissieux', '69200', 200, 45.6975, 4.8869, '2020-11-05', 'active'],
    ['Bron Terraillon', '20 rue Guynemer', 'Bron', '69500', 120, 45.7333, 4.9106, '2024-02-28', 'paused'],
  ] as const
).map(([name, address, city, postalCode, surfaceM2, lat, lng, openedAt, status], i) => ({
  id: u(`2${i}`),
  tenantId: u('1'),
  networkId: u('3'),
  name,
  address,
  city,
  postalCode,
  lat,
  lng,
  surfaceM2,
  timezone: 'Europe/Paris',
  status: status as 'active' | 'paused' | 'closed',
  openedAt: `${openedAt}T09:00:00.000Z`,
}));

export const dashboard: DashboardSummary = {
  scopeLabel: 'Tous les sites',
  revenueToday: e(428700),
  revenueDelta: { pct: 8.2, direction: 'up' },
  revenueYesterday: e(396200),
  machinesActive: 38,
  machinesTotal: 52,
  machinesOutOfService: 3,
  sitesWithOosCount: 2,
  energyVsRefPct: -6.2,
  openTickets: 7,
  criticalTickets: 2,
  sites: (
    // [name, CA, occ%, uptime%, benchPct, alerts, CA-hier, deltaPct, mActive, mTotal, mOOS, energyPct, tickets, critical]
    [
      ['Lyon-3 Guillotière', 124800, 74, 99, 92, 0, 116300, 7.3, 11, 11, 0, -9.1, 1, 0],
      ['Paris-11 Voltaire', 98600, 61, 97, 78, 1, 92400, 6.7, 9, 10, 1, -4.2, 2, 0],
      ['Villeurbanne Gratte-Ciel', 73400, 58, 88, 54, 2, 71900, 2.1, 7, 9, 1, 3.4, 1, 0],
      ['Lyon-7 Jean Macé', 61200, 49, 92, 61, 0, 60100, 1.8, 6, 7, 0, -6.0, 1, 0],
      ['Vénissieux Centre', 42100, 38, 71, 22, 3, 46800, -10.0, 5, 8, 2, 12.4, 2, 2],
      ['Bron Terraillon', 28600, 31, 96, 44, 0, 27700, 3.2, 6, 7, 0, -5.5, 0, 0],
    ] as const
  ).map(([name, ca, occ, up, pct, alerts, caY, delta, mAct, mTot, mOos, ePct, tk, crit], i) => ({
    siteId: u(`2${i}`),
    name,
    revenue: e(ca),
    occupancyPct: occ,
    uptimePct: up,
    benchmarkPercentile: pct,
    openAlerts: alerts,
    revenueYesterday: e(caY),
    revenueDeltaPct: delta,
    machinesActive: mAct,
    machinesTotal: mTot,
    machinesOutOfService: mOos,
    energyVsRefPct: ePct,
    openTickets: tk,
    criticalTickets: crit,
  })),
  alerts: (
    [
      ['critical', 'power', '2 sèche-linge hors service', 'Vénissieux Centre', '2026-06-29T07:48:00.000Z'],
      ['critical', 'droplet', "Surconsommation d'eau détectée", 'Vénissieux Centre', '2026-06-29T07:22:00.000Z'],
      ['warning', 'euro', 'Espèces à collecter — seuil atteint', 'Lyon-3 Guillotière', '2026-06-29T07:00:00.000Z'],
      ['warning', 'alert', 'Écart de réconciliation de 24 €', 'Villeurbanne Gratte-Ciel', '2026-06-29T06:00:00.000Z'],
      ['info', 'wrench', 'Maintenance préventive planifiée', 'Paris-11 Voltaire', '2026-06-29T07:00:00.000Z'],
    ] as const
  ).map(([severity, icon, title, siteName, at], i) => ({
    id: u(`4${i}`),
    severity,
    icon,
    title,
    siteName,
    at,
  })),
  freshness: { asOf: NOW, stale: false },
};

// [code, name, kind, state, detail, cycles, revenueCents, etaSeconds|null]
const MACHINE_DEFS = [
  ['LL-01', 'Lave-linge 8 kg', 'washer', 'running', 'Fin dans 14 min', 7, 2800, 840],
  ['LL-02', 'Lave-linge 8 kg', 'washer', 'free', 'Disponible', 6, 2400, null],
  ['LL-03', 'Lave-linge 8 kg', 'washer', 'running', 'Fin dans 6 min', 8, 3200, 360],
  ['LL-04', 'Lave-linge 11 kg', 'washer', 'finished', 'À vider', 5, 3000, null],
  ['LL-05', 'Lave-linge 11 kg', 'washer', 'free', 'Disponible', 4, 2400, null],
  ['LL-06', 'Lave-linge 18 kg', 'washer', 'running', 'Fin dans 22 min', 6, 5400, 1320],
  ['SL-01', 'Sèche-linge 14 kg', 'dryer', 'free', 'Disponible', 9, 2700, null],
  ['SL-02', 'Sèche-linge 14 kg', 'dryer', 'running', 'Fin dans 9 min', 11, 3300, 540],
  ['SL-03', 'Sèche-linge 14 kg', 'dryer', 'out_of_service', 'Erreur E-04', 0, 0, null],
  ['SL-04', 'Sèche-linge 14 kg', 'dryer', 'finished', 'À vider', 7, 2100, null],
  ['LL-07', 'Lave-linge 8 kg', 'washer', 'free', 'Disponible', 5, 2000, null],
  ['LL-08', 'Lave-linge 8 kg', 'washer', 'running', 'Fin dans 31 min', 6, 2400, 1860],
  ['SL-05', 'Sèche-linge 14 kg', 'dryer', 'offline', 'Hors ligne', 3, 900, null],
  ['LL-09', 'Lave-linge 11 kg', 'washer', 'free', 'Disponible', 4, 2400, null],
  ['SL-06', 'Sèche-linge 14 kg', 'dryer', 'out_of_service', 'Erreur E-12', 0, 0, null],
  ['LL-10', 'Lave-linge 8 kg', 'washer', 'finished', 'À vider', 8, 3200, null],
] as const;

export const machineStatuses: MachineStatusList = {
  items: MACHINE_DEFS.map(([code, name, kind, state, detail, cycles, rev, eta], i) => ({
    machineId: u(`5${i}`),
    code,
    name,
    kind,
    state,
    detail,
    cyclesToday: cycles,
    revenueToday: e(rev),
    etaSeconds: eta ?? null,
    freshness: { asOf: NOW, stale: state === 'offline' },
  })) as MachineStatus[],
  counts: { free: 5, running: 5, finished: 3, out_of_service: 2, offline: 1 } as MachineStateCounts,
  freshness: { asOf: NOW, stale: false },
};

export function machineDetail(id: string): MachineDetail {
  const item = machineStatuses.items.find((m) => m.machineId === id) ?? machineStatuses.items[0]!;
  const oos = item.state === 'out_of_service';
  return {
    id: item.machineId,
    siteId: u('20'),
    code: item.code,
    name: item.name,
    kind: item.kind,
    brand: 'speed_queen',
    model: item.name,
    serial: `${item.code}-2241`,
    capacityKg: item.kind === 'dryer' ? 14 : 8,
    status: item.state,
    statusDetail: item.detail,
    cyclesToday: item.cyclesToday,
    uptime30dPct: oos ? 74.2 : 98.6,
    energyPerCycleKwh: item.kind === 'dryer' ? 2.4 : 0.9,
    openTicketId: oos ? '#2241' : null,
    history: [
      { at: '2026-06-29T12:12:00.000Z', program: 'Coton 40°', durationMin: 32, amount: e(450) },
      { at: '2026-06-29T11:21:00.000Z', program: 'Synthétique 30°', durationMin: 28, amount: e(400) },
      { at: '2026-06-29T10:05:00.000Z', program: 'Coton 60°', durationMin: 38, amount: e(500) },
      { at: '2026-06-29T08:48:00.000Z', program: 'Délicat 30°', durationMin: 24, amount: e(350) },
    ],
  };
}

export const revenue: RevenueSummary = {
  collected: e(428700),
  averageBasket: e(440),
  cycles: 974,
  reconciliationVariance: e(-7500),
  sitesToVerify: 2,
  cashToCollect: e(131200),
  cashCollectorCount: 3,
  reconciliation: (
    [
      ['Lyon-3 Guillotière', 124800, 124800, 124800, 0, 'reconciled'],
      ['Paris-11 Voltaire', 98600, 98200, 98600, -400, 'tolerated'],
      ['Villeurbanne Gratte-Ciel', 75800, 73400, 75800, -2400, 'to_review'],
      ['Lyon-7 Jean Macé', 61200, 61200, 61200, 0, 'reconciled'],
      ['Vénissieux Centre', 46800, 42100, 45500, -4700, 'critical'],
      ['Bron Terraillon', 28600, 28600, 28600, 0, 'reconciled'],
    ] as const
  ).map(([siteName, theo, coll, term, varc, status], i) => ({
    siteId: u(`2${i}`),
    siteName,
    theoretical: e(theo),
    collected: e(coll),
    terminal: e(term),
    variance: e(varc),
    status,
  })),
  methods: (
    [
      ['contactless', 175800, 41],
      ['cash', 162900, 38],
      ['card', 68600, 16],
      ['wallet', 21400, 5],
    ] as const
  ).map(([method, amt, pct]) => ({ method, amount: e(amt), pct })),
  recentRefunds: [
    { id: u('60'), reason: 'Cycle interrompu', machineCode: 'LL-03', siteName: 'Vénissieux Centre', at: '2026-06-29T06:00:00.000Z', amount: e(450) },
    { id: u('61'), reason: 'Trop-perçu sans contact', machineCode: null, siteName: 'Lyon-3 Guillotière', at: '2026-06-28T08:00:00.000Z', amount: e(200) },
    { id: u('62'), reason: 'Sèche-linge HS', machineCode: 'SL-06', siteName: 'Vénissieux Centre', at: '2026-06-28T08:00:00.000Z', amount: e(300) },
  ],
  freshness: { asOf: NOW, stale: false },
};

export const energy: EnergySummary = {
  trajectory: {
    currentKwhM2Year: 45,
    baseKwhM2Year: 78,
    reductionPct: -42,
    onTrack: true,
    targets: [
      { year: 2030, reductionPct: -40, status: 'reached', gapPts: null },
      { year: 2040, reductionPct: -50, status: 'behind', gapPts: -8 },
      { year: 2050, reductionPct: -60, status: 'behind', gapPts: -18 },
    ],
  },
  meters: [
    { kind: 'electricity', value: 2184, unit: 'kWh', deltaPct: -8, anomaly: null, series: [60, 75, 55, 80, 48] },
    { kind: 'water', value: 38.2, unit: 'm³', deltaPct: 11, anomaly: 'Fuite probable · Vénissieux', series: [] },
    { kind: 'gas', value: 612, unit: 'kWh PCS', deltaPct: -3, anomaly: null, series: [70, 62, 75, 58, 52] },
  ],
  heatmapMonths: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
  heatmap: [
    { siteName: 'Lyon-3', cells: [0.22, 0.28, 0.31, 0.26, 0.3, 0.24] },
    { siteName: 'Paris-11', cells: [0.34, 0.4, 0.38, 0.42, 0.45, 0.36] },
    { siteName: 'Villeurbanne', cells: [0.48, 0.52, 0.58, 0.55, 0.6, 0.5] },
    { siteName: 'Lyon-7', cells: [0.3, 0.36, 0.33, 0.38, 0.41, 0.32] },
    { siteName: 'Vénissieux', cells: [0.62, 0.71, 0.78, 0.84, 0.9, 0.8] },
    { siteName: 'Bron', cells: [0.26, 0.3, 0.28, 0.33, 0.31, 0.27] },
  ],
  siteCount: 6,
  freshness: { asOf: NOW, stale: false },
};

export const maintenance: MaintenanceSummary = {
  openTickets: 7,
  criticalTickets: 2,
  mttrHours: 3.2,
  mtbfDays: 142,
  availabilityPct: 96.4,
  machinesTracked: 52,
  tickets: (
    [
      ['#2241', 'Sèche-linge SL-03 — Erreur E-04', 'Vénissieux Centre', 'high', 'open', 'alarm', 'SLA 2 h'],
      ['#2240', "Surconsommation d'eau — fuite probable", 'Vénissieux Centre', 'high', 'assigned', 'alarm', 'SLA 4 h'],
      ['#2238', 'Monnayeur bloqué', 'Villeurbanne Gratte-Ciel', 'medium', 'in_progress', 'customer', 'SLA 1 j'],
      ['#2235', 'Porte LL-06 — joint usé', 'Lyon-3 Guillotière', 'medium', 'assigned', 'operator', 'SLA 2 j'],
      ['#2230', "Bruit anormal à l'essorage", 'Paris-11 Voltaire', 'low', 'open', 'customer', 'SLA 3 j'],
      ['#2228', 'Préventif 5000 cycles', 'Lyon-7 Jean Macé', 'low', 'in_progress', 'plan', '—'],
    ] as const
  ).map(([code, title, siteName, priority, status, source, slaLabel], i) => ({
    id: u(`7${i}`),
    code,
    title,
    siteId: u(`2${i}`),
    siteName,
    machineCode: null,
    priority,
    status,
    source,
    slaLabel,
    slaDueAt: null,
    openedAt: NOW,
  })),
  worklist: [
    { time: '09:00', technicianName: 'Karim B.', task: 'SL-03 — remplacement résistance', siteName: 'Vénissieux', status: 'en_route' },
    { time: '11:30', technicianName: 'Karim B.', task: 'Recherche fuite réseau eau', siteName: 'Vénissieux', status: 'planned' },
    { time: '14:00', technicianName: 'Sophie D.', task: 'Monnayeur — déblocage', siteName: 'Villeurbanne', status: 'planned' },
    { time: '16:00', technicianName: 'Externe · Speed Queen', task: 'Diagnostic essorage', siteName: 'Paris-11', status: 'to_confirm' },
  ],
  plans: [
    { label: 'SL-01 · 5000 cycles', dueLabel: 'Dans 240 cyc.', urgency: 'soon' },
    { label: 'LL-06 · révision annuelle', dueLabel: 'Dans 18 j', urgency: 'ok' },
    { label: 'Détartrage parc Lyon-3', dueLabel: 'À jour', urgency: 'ok' },
  ],
};

export const pricing: PricingSummary = {
  gridName: 'Grille standard',
  grid: (
    [
      ['Lavage 8 kg', 450, 380, 500, 480],
      ['Lavage 11 kg', 650, 550, 700, 680],
      ['Lavage 18 kg', 900, 780, 1000, 950],
      ['Séchage · 10 min', 150, 120, 180, 160],
    ] as const
  ).map(([label, std, off, peak, wknd], i) => ({
    programId: u(`8${i}`),
    programLabel: label,
    prices: { standard: e(std), offpeak: e(off), peak: e(peak), weekend: e(wknd) },
  })),
  yieldBands: [
    { slot: 'offpeak', fromHour: 0, toHour: 8 },
    { slot: 'standard', fromHour: 8, toHour: 17 },
    { slot: 'peak', fromHour: 17, toHour: 21 },
    { slot: 'offpeak', fromHour: 21, toHour: 24 },
  ],
  promotions: [
    { id: u('90'), label: '−20 % séchage · mardi creux', scopeLabel: 'Tous les sites', status: 'active' },
    { id: u('91'), label: 'Happy hour 14–16 h', scopeLabel: 'Lyon-3', status: 'scheduled' },
    { id: u('92'), label: 'Rentrée −15 % grand volume', scopeLabel: 'Réseau', status: 'draft' },
  ],
};

export const customers: CustomersSummary = {
  activeCustomers: 3894,
  walletTotal: e(1248000),
  loyaltyRatePct: 41,
  referrals30d: 128,
  segments: [
    { id: u('a0'), name: 'Réguliers', count: 1284, definitionLabel: '≥ 2 passages / mois', sharePct: 46 },
    { id: u('a1'), name: 'Occasionnels', count: 2057, definitionLabel: '1 passage / 30–90 j', sharePct: 74 },
    { id: u('a2'), name: 'À risque (churn)', count: 341, definitionLabel: 'Aucun passage > 90 j', sharePct: 18 },
    { id: u('a3'), name: 'Nouveaux (30 j)', count: 212, definitionLabel: 'Première visite récente', sharePct: 12 },
  ],
  loyaltyTiers: [
    { tier: 'bronze', count: 2410 },
    { tier: 'silver', count: 1120 },
    { tier: 'gold', count: 364 },
  ],
  campaigns: [
    { id: u('b0'), label: 'SMS heures creuses', channel: 'sms', status: 'active', audienceLabel: 'Réguliers · envoi auto' },
    { id: u('b1'), label: 'E-mail réactivation churn', channel: 'email', status: 'draft', audienceLabel: '341 clients à risque' },
    { id: u('b2'), label: 'Push fin de cycle', channel: 'push', status: 'active', audienceLabel: 'Tous · temps réel' },
  ],
};

export const finance: FinanceSummary = {
  periodLabel: 'Exercice 2025 · oct.',
  consolidatedRevenue: e(3002000),
  charges: e(1459000),
  netMargin: e(1543000),
  vatCollected: e(600400),
  margins: (
    [
      ['Lyon-3 Guillotière', 874000, 312000, 64],
      ['Paris-11 Voltaire', 690000, 348000, 50],
      ['Villeurbanne Gratte-Ciel', 514000, 276000, 46],
      ['Lyon-7 Jean Macé', 429000, 201000, 53],
      ['Vénissieux Centre', 295000, 224000, 24],
      ['Bron Terraillon', 200000, 98000, 51],
    ] as const
  ).map(([siteName, ca, charges, pct], i) => ({
    siteId: u(`2${i}`),
    siteName,
    revenue: e(ca),
    charges: e(charges),
    margin: e(ca - charges),
    marginPct: pct,
  })),
  connectors: [
    { provider: 'pennylane', name: 'Pennylane', status: 'not_connected' },
    { provider: 'sage', name: 'Sage', status: 'not_connected' },
  ],
};

export const network: NetworkSummary = {
  revenue30d: e(3002000),
  benchmarkIndex: 58,
  sitesInAlert: 1,
  royaltiesDue: e(145100),
  royaltyBasisLabel: 'Base : 5 % du CA',
  royaltyStatus: 'to_issue',
  standardizationLabel: "4 / 6 sites conformes au référentiel d'enseigne (tarifs, signalétique, OPERAT).",
  ranking: (
    [
      [1, 'Lyon-3 Guillotière', 874000, 92, 12],
      [2, 'Paris-11 Voltaire', 690000, 78, 4],
      [3, 'Lyon-7 Jean Macé', 429000, 61, 1],
      [4, 'Villeurbanne Gratte-Ciel', 514000, 54, -3],
      [5, 'Bron Terraillon', 200000, 44, -1],
      [6, 'Vénissieux Centre', 295000, 22, -31],
    ] as const
  ).map(([rank, name, ca, index, delta]) => ({
    rank,
    // Resolve to the canonical site id so scope selection / drill-in line up.
    siteId: sites.find((s) => s.name === name)?.id ?? u('20'),
    name,
    revenue: e(ca),
    index,
    deltaPct: delta,
  })),
  exception: {
    siteName: 'Vénissieux Centre',
    message:
      'est un outlier réseau : indice 22, −31 % vs pairs, 2 machines HS et fuite d’eau probable. Action prioritaire.',
  },
};

export const admin: AdminSummary = {
  connectors: [
    {
      group: 'Monétique & machines',
      items: [
        { id: 'lm_control', name: 'LM Control', kind: 'payment_central', kindLabel: 'Centrale de paiement', status: 'connected', note: 'Sync il y a 3 min', lastSyncAt: NOW },
        { id: 'eas', name: 'EAS', kind: 'payment_central', kindLabel: 'Centrale de paiement', status: 'connected', note: 'Sync il y a 5 min', lastSyncAt: NOW },
        { id: 'speed_queen', name: 'Speed Queen', kind: 'machine_brand', kindLabel: 'Parc machines', status: 'connected', note: 'Sync il y a 8 min', lastSyncAt: NOW },
        { id: 'girbau', name: 'Girbau', kind: 'machine_brand', kindLabel: 'Parc machines', status: 'error', note: 'Jeton expiré', lastSyncAt: null },
        { id: 'myosis', name: 'Myosis', kind: 'payment_central', kindLabel: 'Centrale de paiement', status: 'not_connected', note: 'Configuration requise', lastSyncAt: null },
      ],
    },
    {
      group: 'IA, paiement & comptabilité',
      items: [
        { id: 'mistral', name: 'Mistral AI', kind: 'llm', kindLabel: 'Synthèses & assistant', status: 'connected', note: 'Modèle small / large', lastSyncAt: NOW },
        { id: 'stripe', name: 'Stripe', kind: 'billing', kindLabel: 'Facturation SaaS & paiement', status: 'connected', note: 'Mode live', lastSyncAt: NOW },
        { id: 'pennylane', name: 'Pennylane', kind: 'accounting', kindLabel: 'Connecteur comptable', status: 'not_connected', note: 'Configuration requise', lastSyncAt: null },
        { id: 'sage', name: 'Sage', kind: 'accounting', kindLabel: 'Connecteur comptable', status: 'not_connected', note: 'Configuration requise', lastSyncAt: null },
      ],
    },
    {
      group: 'Énergie & messagerie',
      items: [
        { id: 'enedis', name: 'Enedis', kind: 'energy', kindLabel: 'Données de consommation', status: 'connected', note: 'Sync quotidienne', lastSyncAt: NOW },
        { id: 'operat', name: 'ADEME OPERAT', kind: 'energy', kindLabel: 'Déclaration tertiaire', status: 'not_connected', note: 'Configuration requise', lastSyncAt: null },
        { id: 'brevo', name: 'Brevo', kind: 'messaging', kindLabel: 'SMS / e-mail clients', status: 'not_connected', note: 'Configuration requise', lastSyncAt: null },
        { id: 'webpush', name: 'Web Push', kind: 'messaging', kindLabel: 'Notifications fin de cycle', status: 'connected', note: 'Actif', lastSyncAt: NOW },
      ],
    },
  ],
  rbac: {
    roles: [
      { key: 'owner', label: 'Propriétaire' },
      { key: 'manager', label: 'Manager' },
      { key: 'accountant', label: 'Comptable' },
      { key: 'technician', label: 'Technicien' },
      { key: 'viewer', label: 'Lecture' },
    ],
    rows: (
      [
        ['M1:dashboard:view', 'Tableau de bord', [true, true, true, true, true]],
        ['M2:revenue:view', 'Recettes & réconciliation', [true, true, true, false, false]],
        ['M2:refund:approve', 'Valider un remboursement', [true, true, false, false, false]],
        ['M4:ticket:write', 'Maintenance & tickets', [true, true, false, true, false]],
        ['M5:energy:view', 'Énergie & OPERAT', [true, true, true, false, true]],
        ['M7:pricing:write', 'Tarifs & promotions', [true, true, false, false, false]],
        ['M12:users:manage', 'Utilisateurs & rôles', [true, false, false, false, false]],
        ['M12:connectors:manage', 'Connecteurs', [true, false, false, false, false]],
        ['M6:fec:export', 'Export comptable (FEC)', [true, true, true, false, false]],
      ] as const
    ).map(([permissionKey, label, allowed]) => ({ permissionKey, label, allowed: [...allowed] })),
  },
  audit: [
    { id: u('c0'), at: '2026-06-29T12:32:00.000Z', userLabel: 'S. Diallo', action: 'a validé un remboursement', entityLabel: 'Cycle LL-03 · 4,50 €' },
    { id: u('c1'), at: '2026-06-29T11:58:00.000Z', userLabel: 'Système', action: 'a ouvert un ticket automatique', entityLabel: '#2241 · SL-03' },
    { id: u('c2'), at: '2026-06-29T09:20:00.000Z', userLabel: 'M. Lefort', action: 'a modifié la grille tarifaire', entityLabel: 'Heures creuses · Lyon-3' },
    { id: u('c3'), at: '2026-06-29T07:05:00.000Z', userLabel: 'S. Diallo', action: 'a invité un utilisateur', entityLabel: 'k.benali@laveo.fr · Technicien' },
    { id: u('c4'), at: '2026-06-29T06:40:00.000Z', userLabel: 'Système', action: 'a généré le dossier OPERAT', entityLabel: '6 sites · exercice 2025' },
  ],
};

export const notifications: NotificationList = {
  items: (
    [
      ['critical', 'Maintenance', 'power', '2 sèche-linge hors service', 'SL-03 et SL-06 signalés HS par la centrale EAS.', 'Vénissieux Centre', '2026-06-29T07:48:00.000Z', false],
      ['critical', 'Énergie', 'droplet', "Surconsommation d'eau détectée", '+38 % vs référence sur 24 h — fuite probable.', 'Vénissieux Centre', '2026-06-29T07:22:00.000Z', false],
      ['warning', 'Recettes', 'euro', 'Espèces à collecter', 'Monnayeur à 92 % de sa capacité — collecte à planifier.', 'Lyon-3 Guillotière', '2026-06-29T07:00:00.000Z', false],
      ['warning', 'Recettes', 'alert', 'Écart de réconciliation 24 €', 'Encaissé inférieur au théorique sur la collecte du jour.', 'Villeurbanne', '2026-06-29T06:00:00.000Z', false],
      ['info', 'Maintenance', 'wrench', 'Maintenance préventive planifiée', 'Intervention 09:00 — remplacement résistance SL-03.', 'Paris-11 Voltaire', '2026-06-29T07:00:00.000Z', true],
      ['info', 'Énergie', 'euro', 'Dossier OPERAT généré', 'Déclaration 2025 prête pour vos 6 sites.', 'Réseau', '2026-06-28T08:00:00.000Z', true],
    ] as const
  ).map(([severity, category, icon, title, body, siteName, at, read], i) => ({
    id: u(`d${i}`),
    severity,
    category,
    icon,
    title,
    body,
    siteName,
    at,
    read,
  })),
  unreadCount: 4,
};

// ─────────────────── Back-office console (superuser) ────────────────────────

export const tenantGroups: TenantGroup[] = (
  [
    // Lavéo's group id === the current session tenant id (u('1')) so tickets
    // filed from the support widget resolve to a real group.
    ['1', 'Groupe Lavéo', 'scale', 'active', 6, 14, 149000, 'sophie@laveo.fr', '2021-02-10'],
    ['a1', 'Wash&Go', 'growth', 'active', 4, 7, 79000, 'contact@washandgo.fr', '2022-05-18'],
    ['a2', 'Bulle Express', 'starter', 'trial', 2, 3, 0, 'gerard@bulle-express.fr', '2026-06-12'],
    ['a3', 'Netteo', 'enterprise', 'active', 21, 48, 512000, 'admin@netteo.com', '2020-09-01'],
    ['a4', 'LavoZen', 'growth', 'past_due', 5, 9, 99000, 'billing@lavozen.fr', '2023-11-22'],
    ['a5', 'CleanCircle', 'starter', 'suspended', 1, 2, 39000, 'hello@cleancircle.fr', '2024-03-30'],
  ] as const
).map(([id, name, plan, status, sitesCount, usersCount, mrrCents, ownerEmail, created]) => ({
  id: u(id),
  name,
  plan,
  status,
  sitesCount,
  usersCount,
  mrrCents,
  ownerEmail,
  createdAt: `${created}T09:00:00.000Z`,
}));

export const accounts: AccountUser[] = (
  [
    ['1', 'Groupe Lavéo', 'Sophie Diallo', 'sophie@laveo.fr', 'owner', 'active', '2026-06-29T07:40:00.000Z'],
    ['1', 'Groupe Lavéo', 'Marc Lefort', 'marc@laveo.fr', 'manager', 'active', '2026-06-28T18:12:00.000Z'],
    ['1', 'Groupe Lavéo', 'Karim Benali', 'k.benali@laveo.fr', 'technician', 'active', '2026-06-29T06:05:00.000Z'],
    ['a1', 'Wash&Go', 'Julie Moreau', 'julie@washandgo.fr', 'owner', 'active', '2026-06-27T10:30:00.000Z'],
    ['a1', 'Wash&Go', 'Paul Girard', 'paul@washandgo.fr', 'accountant', 'invited', null],
    ['a3', 'Netteo', 'Léa Fontaine', 'lea@netteo.com', 'owner', 'active', '2026-06-29T05:50:00.000Z'],
    ['a3', 'Netteo', 'Thomas Roy', 't.roy@netteo.com', 'viewer', 'suspended', '2026-05-02T14:00:00.000Z'],
    ['a4', 'LavoZen', 'Nadia Cherif', 'nadia@lavozen.fr', 'manager', 'active', '2026-06-26T09:15:00.000Z'],
  ] as const
).map(([g, groupName, fullName, email, role, status, lastActiveAt], i) => ({
  id: u(`b${i}`),
  groupId: u(g),
  groupName,
  fullName,
  email,
  role,
  status,
  lastActiveAt,
  createdAt: '2025-01-15T09:00:00.000Z',
}));

export const supportTickets: SupportTicket[] = (
  [
    ['SUP-1042', 'Écart de réconciliation sur Lyon-3', '1', 'Groupe Lavéo', 'Marc Lefort', 'marc@laveo.fr', 'open', 'high', 'billing', '2026-06-29T06:20:00.000Z',
      [['client', 'Marc Lefort', 'Bonjour, un écart de 4,50 € persiste sur la journée d’hier pour Lyon-3.', '2026-06-29T06:20:00.000Z']]],
    ['SUP-1041', 'Sèche-linge SL-03 hors-ligne', 'a1', 'Wash&Go', 'Julie Moreau', 'julie@washandgo.fr', 'pending', 'urgent', 'technical', '2026-06-29T05:10:00.000Z',
      [['client', 'Julie Moreau', 'Le SL-03 ne remonte plus de données depuis ce matin.', '2026-06-29T05:10:00.000Z'],
       ['staff', 'Support LavoPilot', 'Merci, nous vérifions le connecteur Speed Queen — retour sous 1 h.', '2026-06-29T05:40:00.000Z']]],
    ['SUP-1040', 'Ajouter un rôle « comptable lecture seule »', 'a3', 'Netteo', 'Léa Fontaine', 'lea@netteo.com', 'open', 'normal', 'feature', '2026-06-28T16:02:00.000Z',
      [['client', 'Léa Fontaine', 'Serait-il possible d’avoir un rôle comptable en lecture seule ?', '2026-06-28T16:02:00.000Z']]],
    ['SUP-1039', 'Facture de juin introuvable', 'a4', 'LavoZen', 'Nadia Cherif', 'nadia@lavozen.fr', 'resolved', 'normal', 'billing', '2026-06-27T11:30:00.000Z',
      [['client', 'Nadia Cherif', 'Je ne retrouve pas ma facture de juin.', '2026-06-27T11:30:00.000Z'],
       ['staff', 'Support LavoPilot', 'La voici en pièce jointe, désolé pour la gêne.', '2026-06-27T13:12:00.000Z']]],
    ['SUP-1038', 'Demande de suppression de compte (RGPD)', 'a5', 'CleanCircle', 'Hugo Blanc', 'hugo@cleancircle.fr', 'closed', 'low', 'account', '2026-06-20T09:00:00.000Z',
      [['client', 'Hugo Blanc', 'Merci de supprimer notre compte conformément au RGPD.', '2026-06-20T09:00:00.000Z'],
       ['staff', 'Support LavoPilot', 'Compte purgé, confirmation envoyée par e-mail.', '2026-06-21T10:00:00.000Z']]],
  ] as const
).map(([ref, subject, g, groupName, requesterName, requesterEmail, status, priority, category, createdAt, msgs], i) => ({
  id: u(`c${i}`),
  ref,
  subject,
  groupId: u(g),
  groupName,
  requesterName,
  requesterEmail,
  status,
  priority,
  category,
  createdAt,
  updatedAt: msgs[msgs.length - 1]![2],
  messages: msgs.map(([authorRole, authorName, body, at], j) => ({
    id: u(`d${i}${j}`),
    authorRole,
    authorName,
    body,
    at,
  })),
}));
