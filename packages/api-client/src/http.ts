import type { Period } from '@pilotage/shared';
import type { PilotageApi } from './types';

export interface HttpClientOptions {
  baseUrl: string;
  /** Returns the current bearer token (Cognito id/access token), if any. */
  getToken?: () => string | null | undefined;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Real HTTP client against the NestJS backend. */
export function createHttpClient(opts: HttpClientOptions): PilotageApi {
  async function get<T>(path: string): Promise<T> {
    const token = opts.getToken?.();
    const res = await fetch(`${opts.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as { code?: string; title?: string };
      throw new ApiError(res.status, problem.code ?? 'internal', problem.title ?? res.statusText);
    }
    return res.json() as Promise<T>;
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const token = opts.getToken?.();
    const res = await fetch(`${opts.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as { code?: string; title?: string };
      throw new ApiError(res.status, problem.code ?? 'internal', problem.title ?? res.statusText);
    }
    return res.json() as Promise<T>;
  }

  return {
    getSession: () => get('/me'),
    getBranding: () => get('/branding'),
    getDashboard: (period: Period) => get(`/dashboard?period=${period}`),
    getMachineStatuses: () => get('/machines/status'),
    getMachineDetail: (id: string) => get(`/machines/${id}`),
    getRevenue: (period: Period) => get(`/revenue?period=${period}`),
    getEnergy: () => get('/energy'),
    generateOperat: (year: number) => post('/energy/operat', { year }),
    getMaintenance: () => get('/maintenance'),
    getPricing: () => get('/pricing'),
    getCustomers: () => get('/customers'),
    getFinance: () => get('/finance'),
    getNetwork: () => get('/network'),
    getAdmin: () => get('/admin'),
    getNotifications: () => get('/notifications'),
    getSites: () => get('/sites'),
    createSupportTicket: (input) => post('/support/tickets', input),
    getSupportTickets: () => get('/console/tickets'),
    replySupportTicket: (input) => post(`/console/tickets/${input.ticketId}/reply`, input),
    getTenantGroups: () => get('/console/groups'),
    getAccounts: () => get('/console/accounts'),
    createAccount: (input) => post('/console/accounts', input),
    updateAccount: (input) => post(`/console/accounts/${input.id}`, input),
  };
}
