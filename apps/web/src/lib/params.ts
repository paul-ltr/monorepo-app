import { useSyncExternalStore } from 'react';

/**
 * Client-side, admin-configurable app parameters. In the mock/demo these live in
 * localStorage; with the backend they map to `core` connector/config rows. Kept
 * out of the API contract so the UI can be exercised offline. Secrets (API keys)
 * are never persisted here — only the fact that one was configured.
 */
export interface TicketForwardingConfig {
  /** Forward newly-created maintenance tickets to an external GMAO/helpdesk. */
  enabled: boolean;
  /** Display name of the target software (e.g. "Zendesk", "GMAO Corim"). */
  software: string;
  /** Webhook URL or destination email the ticket is pushed to. */
  target: string;
}

export interface BrevoConfig {
  enabled: boolean;
  senderName: string;
  senderEmail: string;
  /** True once an API key was saved server-side (the key itself is never stored here). */
  keyConfigured: boolean;
}

/** Per-site parameters an admin can set (energy identifiers, address). */
export interface SiteParams {
  address: string;
  /** Enedis PDL/PRM — 14 digits. */
  pdl: string;
  /** GRDF PCE — 14 digits. */
  pce: string;
}

export interface AppParams {
  ticketForwarding: TicketForwardingConfig;
  brevo: BrevoConfig;
  /** Per-site parameter overrides, keyed by site id. */
  sites: Record<string, SiteParams>;
}

const DEFAULTS: AppParams = {
  ticketForwarding: { enabled: false, software: '', target: '' },
  brevo: { enabled: false, senderName: '', senderEmail: '', keyConfigured: false },
  sites: {},
};

export const emptySiteParams = (): SiteParams => ({ address: '', pdl: '', pce: '' });

const KEY = 'pilotage-app-params';

function load(): AppParams {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<AppParams>;
    return {
      ticketForwarding: { ...DEFAULTS.ticketForwarding, ...(p.ticketForwarding ?? {}) },
      brevo: { ...DEFAULTS.brevo, ...(p.brevo ?? {}) },
      sites: p.sites ?? {},
    };
  } catch {
    return DEFAULTS;
  }
}

let current: AppParams = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Merge a partial patch (nested keys are shallow-merged) and notify subscribers. */
export function setAppParams(patch: Partial<AppParams>) {
  current = {
    ticketForwarding: { ...current.ticketForwarding, ...(patch.ticketForwarding ?? {}) },
    brevo: { ...current.brevo, ...(patch.brevo ?? {}) },
    sites: { ...current.sites, ...(patch.sites ?? {}) },
  };
  persist();
}

export function useAppParams(): [AppParams, (patch: Partial<AppParams>) => void] {
  const params = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
  return [params, setAppParams];
}
