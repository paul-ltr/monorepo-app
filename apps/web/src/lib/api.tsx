import { createContext, useContext, type ReactNode } from 'react';
import { createClient, type PilotageApi } from '@pilotage/api-client';
import { env } from './env';
import { getAccessToken } from './cognito';

// One client per app. In real mode it attaches the current Cognito access token
// as a bearer (the API verifies the access token); mock/dev mode has no token.
const client: PilotageApi = createClient({
  mock: env.useMocks,
  baseUrl: env.apiBaseUrl,
  getToken: () => getAccessToken(),
});

const ApiContext = createContext<PilotageApi>(client);

export function ApiProvider({ children }: { children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export const useApi = () => useContext(ApiContext);
