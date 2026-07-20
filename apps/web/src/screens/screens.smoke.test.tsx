import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiProvider } from '@/lib/api';
import { ScopeProvider } from '@/lib/scope';
import { Machines } from './Machines';
import { Energy } from './Energy';
import { Maintenance } from './Maintenance';
import { Pricing } from './Pricing';
import { Clients } from './Clients';
import { Finances } from './Finances';
import { Settings } from './Settings';

/**
 * Runtime smoke test: mount each reworked screen against the in-browser mock
 * client and assert its new sections paint without throwing. Covers the code the
 * sandboxed environment could not click through (Chrome was unavailable).
 */
function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ApiProvider>
        <ScopeProvider>{node}</ScopeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

const cases: [string, ReactNode, RegExp][] = [
  ['Machines', <Machines />, /Répartition des états/i],
  ['Energy', <Energy />, /Consommation globale/i],
  ['Maintenance', <Maintenance />, /Plan préventif/i],
  ['Pricing', <Pricing />, /Tarification horaire/i],
  ['Clients', <Clients />, /Programme fidélité/i],
  ['Finances', <Finances />, /Connecteurs comptables/i],
  ['Settings', <Settings />, /Paramètres par site/i],
];

describe('reworked screens render against the mock client', () => {
  for (const [name, node, marker] of cases) {
    it(`${name} mounts and paints its new sections`, async () => {
      render(wrap(node));
      expect(await screen.findByText(marker)).toBeInTheDocument();
    });
  }
});
