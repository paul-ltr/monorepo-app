/**
 * Bridge by Bankin' — open-banking aggregation (agrégation bancaire DSP2, M6).
 * Endpoints and flow per the Bridge API docs (https://docs.bridgeapi.io):
 *
 *   1. create user:     POST {base}/v3/aggregation/users
 *   2. connect session: POST {base}/v3/aggregation/connect-sessions
 *        → returns `url`, the hosted Bridge Connect page where the customer
 *          picks their bank and authenticates (strong customer authentication).
 *   3. redirect back:   Bridge sends the customer to our `callback_url`.
 *   4. list accounts:   GET {base}/v3/aggregation/accounts
 *   5. list txns:       GET {base}/v3/aggregation/transactions (data repo poller)
 *
 * Auth is header-based (`Client-Id` / `Client-Secret` + a pinned `Bridge-Version`),
 * not a bearer token — so there is no client-side authorize-URL builder like
 * Pennylane's: the consent URL is minted by Bridge. These constants are shared so
 * the NestJS service and any test harness pin the exact same API surface.
 *
 * Bridge is the French market leader for embedded open banking; its hosted
 * "Connect" flow is the easiest possible onboarding for a customer — one click,
 * pick your bank, consent — which is why it backs the "Connecter ma banque" card.
 */
export const BRIDGE_API_BASE_URL = 'https://api.bridgeapi.io';
/** Pinned API version — Bridge requires this header on every call. */
export const BRIDGE_API_VERSION = '2025-01-15';
export const BRIDGE_USERS_PATH = '/v3/aggregation/users';
export const BRIDGE_CONNECT_SESSIONS_PATH = '/v3/aggregation/connect-sessions';
export const BRIDGE_ACCOUNTS_PATH = '/v3/aggregation/accounts';
export const BRIDGE_AUTH_TOKEN_PATH = '/v3/aggregation/authorization/token';

/** The headers Bridge expects on every aggregation call. */
export function bridgeHeaders(opts: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
}): Record<string, string> {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'Bridge-Version': BRIDGE_API_VERSION,
    'Client-Id': opts.clientId,
    'Client-Secret': opts.clientSecret,
    ...(opts.accessToken ? { authorization: `Bearer ${opts.accessToken}` } : {}),
  };
}
