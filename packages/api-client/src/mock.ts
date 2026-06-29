import type { Period } from '@pilotage/shared';
import type { PilotageApi } from './types';
import * as f from './fixtures';

const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** In-browser mock implementing the full API from bundled fixtures. */
export function createMockClient(): PilotageApi {
  return {
    getSession: () => delay(f.session),
    getBranding: () => delay(f.branding),
    getDashboard: (_period: Period) => delay(f.dashboard),
    getMachineStatuses: () => delay(f.machineStatuses),
    getMachineDetail: (id: string) => delay(f.machineDetail(id)),
    getRevenue: (_period: Period) => delay(f.revenue),
    getEnergy: () => delay(f.energy),
    generateOperat: (year: number) =>
      delay({
        id: '00000000-0000-7000-8000-0000000000ff',
        year,
        status: 'ready' as const,
        siteCount: 6,
        fileKey: `operat/${year}/dossier.pdf`,
        createdAt: '2026-06-29T08:00:00.000Z',
      }),
    getMaintenance: () => delay(f.maintenance),
    getPricing: () => delay(f.pricing),
    getCustomers: () => delay(f.customers),
    getFinance: () => delay(f.finance),
    getNetwork: () => delay(f.network),
    getAdmin: () => delay(f.admin),
    getNotifications: () => delay(f.notifications),
    getSites: () => delay(f.sites),
  };
}
