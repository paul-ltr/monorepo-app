/**
 * Electrolux OneApp / OCP connector (M1/M12 — machine brand). Ports the consumer
 * mobile-app API used by `Woyken/py-electrolux-ocp` so a user can connect their
 * Electrolux (or AEG) group account from the app with their email + password.
 *
 * ⚠️ This is the *unofficial* consumer API (the same one the Electrolux OneApp
 * mobile app uses), not the public developer.electrolux.one API — it has no
 * hosted OAuth redirect for third parties. It is ToS-sensitive and the hard-coded
 * client constants below can change; they are overridable via env in the API.
 *
 * Login flow (all ported to the NestJS ElectroluxService):
 *   1. client-cred token   POST {base}/one-account-authorization/api/v1/token
 *   2. identity providers  GET  {base}/one-account-user/api/v1/identity-providers
 *                            → Gigya {domain, apiKey} + regional base URL
 *   3. Gigya login (SAP CDC): socialize.getIDs → accounts.login → accounts.getJWT
 *                            (OAuth1 HMAC-SHA1 signed) → id_token
 *   4. token exchange      POST {region}/one-account-authorization/api/v1/token
 *   5. appliances          GET  {region}/appliance/api/v2/appliances
 *
 * The pure URL/string builders live here so the service and its unit tests share
 * one source of truth (the HMAC itself stays server-side — see ElectroluxService).
 */

export const ELECTROLUX_OCP_BASE = 'https://api.ocp.electrolux.one';

export type ElectroluxBrand = 'electrolux' | 'aeg';

/** Public mobile-app client constants, per brand (reverse-engineered, overridable). */
export const ELECTROLUX_BRAND_CLIENTS: Record<
  ElectroluxBrand,
  { apiKey: string; clientId: string; clientSecret: string }
> = {
  electrolux: {
    apiKey: '2AMqwEV5MqVhTKrRCyYfVF8gmKrd2rAmp7cUsfky',
    clientId: 'ElxOneApp',
    clientSecret:
      '8UKrsKD7jH9zvTV7rz5HeCLkit67Mmj68FvRVTlYygwJYy4dW6KF2cVLPKeWzUQUd6KJMtTifFf4NkDnjI7ZLdfnwcPtTSNtYvbP7OzEkmQD9IjhMOf5e1zeAQYtt2yN',
  },
  aeg: {
    apiKey: 'PEdfAP7N7sUc95GJPePDU54e2Pybbt6DZtdww7dz',
    clientId: 'AEGOneApp',
    clientSecret:
      'G6PZWyneWAZH6kZePRjZAdBbyyIu3qUgDGUDkat7obfU9ByQSgJPNy8xRo99vzcgWExX9N48gMJo3GWaHbMJsohIYOQ54zH2Hid332UnRZdvWOCWvWNnMNLalHoyH7xU',
  },
};

// ── OCP endpoint builders ───────────────────────────────────────────────────

export const ocpTokenUrl = (base: string) =>
  `${base.replace(/\/$/, '')}/one-account-authorization/api/v1/token`;

export const ocpIdentityProvidersUrl = (base: string, brand: string, countryCode: string) => {
  const url = new URL(`${base.replace(/\/$/, '')}/one-account-user/api/v1/identity-providers`);
  url.searchParams.set('brand', brand);
  url.searchParams.set('countryCode', countryCode);
  return url.toString();
};

export const ocpAppliancesUrl = (base: string, includeMetadata = true) =>
  `${base.replace(/\/$/, '')}/appliance/api/v2/appliances${
    includeMetadata ? '?includeMetadata=true' : ''
  }`;

export const ocpAppliancesInfoUrl = (base: string) =>
  `${base.replace(/\/$/, '')}/appliance/api/v2/appliances/info`;

// ── Gigya (SAP CDC) helpers ─────────────────────────────────────────────────

export const gigyaGetIdsUrl = (domain: string) => `https://socialize.${domain}/socialize.getIDs`;
export const gigyaLoginUrl = (domain: string) => `https://accounts.${domain}/accounts.login`;
export const gigyaGetJwtUrl = (domain: string) => `https://accounts.${domain}/accounts.getJWT`;

/**
 * Gigya percent-encoding: like encodeURIComponent but spaces → %20 and ~ kept
 * raw (matches SAP's GSSDK and py-electrolux-ocp `url_encode`).
 */
export function gigyaEncode(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return encodeURIComponent(value).replace(/%7E/g, '~');
}

/** Build the sorted `key=value&...` query string Gigya signs over. */
export function buildSortedQs(params: Record<string, string | number | boolean | undefined>): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${gigyaEncode(params[k] as string | number | boolean)}`)
    .join('&');
}

/**
 * Build the OAuth1 base string Gigya's `accounts.getJWT` is signed with:
 *   METHOD & encode(normalizedUrl) & encode(sortedQueryString)
 * `normalizedUrl` is lowercase scheme+host + path, default ports dropped.
 */
export function buildGigyaBaseString(
  method: string,
  url: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const u = new URL(url);
  const protocol = 'https';
  let normalized = `${protocol}://${u.hostname.toLowerCase()}`;
  if (u.port && u.port !== '443' && u.port !== '80') normalized += `:${u.port}`;
  normalized += u.pathname;
  return `${method.toUpperCase()}&${gigyaEncode(normalized)}&${gigyaEncode(buildSortedQs(params))}`;
}
