import { createContext, useContext, type ReactNode } from 'react';
import { createClient, type PilotageApi } from '@pilotage/api-client';
import { env } from './env';

// One client per app. Token wiring (Cognito) plugs in here when AUTH_DEV_BYPASS
// is off; in mock/dev mode there is no token.
const client: PilotageApi = createClient({
  mock: env.useMocks,
  baseUrl: env.apiBaseUrl,
  getToken: () => null,
});

const ApiContext = createContext<PilotageApi>(client);

export function ApiProvider({ children }: { children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export const useApi = () => useContext(ApiContext);
