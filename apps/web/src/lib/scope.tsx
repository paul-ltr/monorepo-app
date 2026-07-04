import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Site } from '@pilotage/shared';
import { useApi } from './api';

/** The active supervision perimeter: the whole network, or a single site. */
export type Scope = { type: 'all' } | { type: 'site'; siteId: string; name: string };

interface ScopeCtx {
  scope: Scope;
  /** All sites in the tenant (empty until loaded). */
  sites: Site[];
  isAll: boolean;
  /** Short label for the topbar / breadcrumbs. */
  label: string;
  setScope: (scope: Scope) => void;
  selectSite: (siteId: string) => void;
  reset: () => void;
}

const ALL: Scope = { type: 'all' };
const STORAGE_KEY = 'pilotage-scope';

const ScopeContext = createContext<ScopeCtx>({
  scope: ALL,
  sites: [],
  isAll: true,
  label: 'Tous les sites',
  setScope: () => {},
  selectSite: () => {},
  reset: () => {},
});

/** Active site scope, shared across the shell and every screen. */
export const useScope = () => useContext(ScopeContext);

function readStored(): Scope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL;
    const parsed = JSON.parse(raw) as Scope;
    if (parsed.type === 'site' && parsed.siteId) return parsed;
  } catch {
    /* ignore */
  }
  return ALL;
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => api.getSites() });
  const [scope, setScopeState] = useState<Scope>(readStored);

  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    try {
      if (next.type === 'all') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const selectSite = useCallback(
    (siteId: string) => {
      const site = sites.find((s) => s.id === siteId);
      setScope(site ? { type: 'site', siteId, name: site.name } : ALL);
    },
    [sites, setScope],
  );

  // Once sites load, refresh the stored site's name (in case it changed).
  useEffect(() => {
    if (scope.type !== 'site' || sites.length === 0) return;
    const site = sites.find((s) => s.id === scope.siteId);
    if (!site) setScope(ALL);
    else if (site.name !== scope.name) setScope({ type: 'site', siteId: site.id, name: site.name });
  }, [sites, scope, setScope]);

  const value = useMemo<ScopeCtx>(
    () => ({
      scope,
      sites,
      isAll: scope.type === 'all',
      label: scope.type === 'all' ? 'Tous les sites' : scope.name,
      setScope,
      selectSite,
      reset: () => setScope(ALL),
    }),
    [scope, sites, setScope, selectSite],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}
