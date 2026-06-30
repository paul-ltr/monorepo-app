import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { ApiProvider } from '@/lib/api';
import { Revenue } from './Revenue';

/**
 * Renders a real MVP screen (M2 reconciliation) against the in-browser mock
 * client and asserts the design data binds. This also proves the React app
 * mounts and paints in a DOM (the sandboxed live preview could not).
 */
function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ApiProvider>{node}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('Revenue screen', () => {
  it('renders the reconciliation table from the API', async () => {
    render(wrap(<Revenue />));

    // Title (FR) is present immediately.
    expect(screen.getByRole('heading', { name: /Recettes & monétique/i })).toBeInTheDocument();

    // After the mock query resolves, the reconciliation section + a site appear.
    await waitFor(() =>
      expect(screen.getByText(/Réconciliation des recettes/i)).toBeInTheDocument(),
    );
    // The site appears in the reconciliation table (and again in refunds), and a
    // fr-FR euro amount renders — both confirm the data bound and formatted.
    expect(screen.getAllByText(/Lyon-3 Guillotière/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/287/).length).toBeGreaterThan(0);
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(wrap(<Revenue />));
    await screen.findByText(/Réconciliation des recettes/i);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
