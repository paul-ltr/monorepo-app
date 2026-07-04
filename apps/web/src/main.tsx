import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './index.css';
import { router } from './app/router';
import { queryClient } from './lib/query';
import { AppProviders, AuthGate } from './app/providers';

const rootEl = document.getElementById('root')!;

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </AppProviders>
    </QueryClientProvider>
  </StrictMode>,
);
