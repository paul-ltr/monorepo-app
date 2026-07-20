import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiProvider } from '@/lib/api';
import { ScopeProvider } from '@/lib/scope';
import { Chat } from './Chat';

/**
 * Drives the LavoPilot chat against the in-browser mock: the empty state greets
 * the user, and picking an opener produces a data-backed assistant reply.
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

describe('LavoPilot chat', () => {
  it('greets on the empty state and answers a revenue question', async () => {
    render(wrap(<Chat />));
    // Empty state greeting.
    expect(await screen.findByText(/je suis/i)).toBeInTheDocument();

    // Pick the revenue opener chip.
    fireEvent.click(screen.getByText('Comment vont mes recettes aujourd’hui ?'));

    // The assistant replies with a data-backed revenue line.
    expect(await screen.findByText(/recettes s'élèvent à/i)).toBeInTheDocument();
  });

  it('offers an in-chat connect card when asked to link a meter', async () => {
    render(wrap(<Chat />));
    fireEvent.click(await screen.findByText('Connecter un compteur'));
    // The reusable onboarding widget mounts inline.
    expect(await screen.findByText(/Connecter un PDL\/PRM/i)).toBeInTheDocument();
  });
});
