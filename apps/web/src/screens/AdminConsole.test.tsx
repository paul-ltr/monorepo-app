import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { ApiProvider } from '@/lib/api';
import { AdminConsole } from './AdminConsole';
import { SupportWidget } from '@/components/SupportWidget';

/**
 * Exercises the superuser back-office console and the floating support widget
 * against the in-browser mock client: ticket triage, group registry, account
 * management, and end-to-end ticket creation.
 */
function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ApiProvider>{node}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('AdminConsole', () => {
  it('renders ticket triage from the API', async () => {
    render(wrap(<AdminConsole />));
    expect(screen.getByRole('heading', { name: /Console d'administration/i })).toBeInTheDocument();
    // Ticket list binds from the mock.
    await waitFor(() => expect(screen.getAllByText('SUP-1042').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Groupe Lavéo/).length).toBeGreaterThan(0);
  });

  it('switches to the groups tab and shows the registry', async () => {
    render(wrap(<AdminConsole />));
    fireEvent.click(screen.getByRole('button', { name: /Groupes/i }));
    await waitFor(() => expect(screen.getByText('MRR total')).toBeInTheDocument());
    expect(screen.getByText('Netteo')).toBeInTheDocument();
  });

  it('creates an account from the accounts tab', async () => {
    render(wrap(<AdminConsole />));
    fireEvent.click(screen.getByRole('button', { name: /Comptes/i }));
    await screen.findByText(/Créer un compte/i);

    fireEvent.change(screen.getByRole('combobox', { name: /Groupe/i }), {
      target: { value: '00000000-0000-7000-8000-0000000000a1' }, // Wash&Go (u('a1'))
    });
    fireEvent.change(screen.getByPlaceholderText(/Nom complet/i), { target: { value: 'Alice Martin' } });
    fireEvent.change(screen.getByPlaceholderText(/email@groupe/i), { target: { value: 'alice@washandgo.fr' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer l'invitation/i }));

    await waitFor(() => expect(screen.getByText(/Invitation envoyée à alice@washandgo.fr/i)).toBeInTheDocument());
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(wrap(<AdminConsole />));
    await screen.findAllByText('SUP-1042');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('SupportWidget', () => {
  it('files a ticket and confirms with a reference', async () => {
    render(wrap(<SupportWidget />));
    fireEvent.click(screen.getByRole('button', { name: /Contacter le support/i }));

    fireEvent.change(await screen.findByPlaceholderText(/Objet de votre demande/i), {
      target: { value: 'Test depuis le widget' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Décrivez votre problème/i), {
      target: { value: 'Bonjour, ceci est un test.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer au support/i }));

    await waitFor(() => expect(screen.getByText(/Demande envoyée/i)).toBeInTheDocument());
    expect(screen.getByText(/^SUP-\d+$/)).toBeInTheDocument();
  });
});
