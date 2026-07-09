import { parseFeatureFlags } from '@pilotage/shared';

const raw = import.meta.env;

/** Typed view over Vite env vars. Mock mode is on unless a backend is wired. */
export const env = {
  apiBaseUrl: (raw.VITE_API_BASE_URL as string | undefined) || undefined,
  useMocks: (raw.VITE_USE_MOCKS as string | undefined) !== 'false',
  authDevBypass: (raw.VITE_AUTH_DEV_BYPASS as string | undefined) !== 'false',
  featureFlags: parseFeatureFlags(raw.VITE_FEATURE_FLAGS as string | undefined),
  cognito: {
    userPoolId: (raw.VITE_COGNITO_USER_POOL_ID as string | undefined) || undefined,
    clientId: (raw.VITE_COGNITO_CLIENT_ID as string | undefined) || undefined,
    region: (raw.VITE_COGNITO_REGION as string | undefined) || 'eu-west-3',
  },
};
