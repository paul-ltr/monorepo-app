import { parseFeatureFlags } from '@pilotage/shared';

const raw = import.meta.env;

/** Typed view over Vite env vars. Mock mode is on unless a backend is wired. */
export const env = {
  apiBaseUrl: (raw.VITE_API_BASE_URL as string | undefined) || undefined,
  useMocks: (raw.VITE_USE_MOCKS as string | undefined) !== 'false',
  authDevBypass: (raw.VITE_AUTH_DEV_BYPASS as string | undefined) !== 'false',
  featureFlags: parseFeatureFlags(raw.VITE_FEATURE_FLAGS as string | undefined),
};
