/**
 * Miele 3rd Party API connector (M1/M12 — machine brand). Uses Miele's official
 * OAuth 2.0 **authorization-code** flow (hosted login redirect) to connect a
 * Miele@home account, then lists the account's appliances so each can be
 * associated with a shop. Docs: https://developer.miele.com/docs/swagger
 *
 *   authorize: GET  {base}/thirdparty/login ?client_id&response_type=code
 *                     &redirect_uri&state&vg
 *   token:     POST {base}/thirdparty/token  (authorization_code / refresh_token)
 *   devices:   GET  {base}/v1/devices        (Bearer, Accept: application/json)
 *
 * The `vg` parameter is the account's locale group (e.g. fr-FR, de-DE) chosen at
 * Miele@home registration; the wrong value breaks the login. Shared so the NestJS
 * service builds the exact same URL the web app expects and it stays unit-testable.
 */

export const MIELE_API_BASE = 'https://api.mcs3.miele.com';
export const MIELE_AUTHORIZE_URL = `${MIELE_API_BASE}/thirdparty/login`;
export const MIELE_TOKEN_URL = `${MIELE_API_BASE}/thirdparty/token`;
/** Devices live under the /v1 path. */
export const mieleDevicesUrl = (base: string) => `${base.replace(/\/$/, '')}/v1/devices`;

export function buildMieleAuthorizeUrl(opts: {
  authorizeUrl?: string;
  clientId: string;
  redirectUri: string;
  state: string;
  vg: string;
}): string {
  const url = new URL(opts.authorizeUrl ?? MIELE_AUTHORIZE_URL);
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('state', opts.state);
  url.searchParams.set('vg', opts.vg);
  return url.toString();
}

/** Map a Miele device type (raw code + localized label) to our machine_kind. */
export function mapMieleType(valueRaw: number | undefined, valueLocalized: string | undefined): 'washer' | 'dryer' | 'combo' | 'dispenser' {
  // Miele device type codes: 1 washing machine, 2 tumble dryer, 24 washer-dryer.
  if (valueRaw === 24) return 'combo';
  if (valueRaw === 1) return 'washer';
  if (valueRaw === 2) return 'dryer';
  const t = (valueLocalized ?? '').toLowerCase();
  if (t.includes('washer dryer') || t.includes('washer-dryer')) return 'combo';
  if (t.includes('dryer')) return 'dryer';
  if (t.includes('washing') || t.includes('washer')) return 'washer';
  return 'washer';
}
