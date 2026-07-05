import { useSyncExternalStore } from 'react';

/**
 * Client-side, admin-configurable app parameters. In the mock/demo these live in
 * localStorage. Per-site energy identifiers (PDL/PCE), addresses and contacts and
 * the Brevo API key are now persisted server-side (core.site + AWS Secrets
 * Manager) and no longer kept here.
 */
export interface TicketForwardingConfig {
  /** Forward newly-created maintenance tickets to an external GMAO/helpdesk. */
  enabled: boolean;
  /** Display name of the target software (e.g. "Zendesk", "GMAO Corim"). */
  software: string;
  /** Webhook URL or destination email the ticket is pushed to. */
  target: string;
}

export interface AppParams {
  ticketForwarding: TicketForwardingConfig;
}

const DEFAULTS: AppParams = {
  ticketForwarding: { enabled: false, software: '', target: '' },
};

const KEY = 'pilotage-app-params';

function load(): AppParams {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<AppParams>;
    return {
      ticketForwarding: { ...DEFAULTS.ticketForwarding, ...(p.ticketForwarding ?? {}) },
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
