/**
 * Pennylane OAuth 2.0 (accounting connector, M6). Endpoints and parameters per
 * the Pennylane Company API docs (https://pennylane.readme.io/docs/oauth-20-walkthrough):
 *
 *   authorize: GET https://app.pennylane.com/oauth/authorize
 *     ?client_id&redirect_uri&response_type=code&scope&state
 *   token:     POST https://app.pennylane.com/oauth/token
 *     client_id, client_secret, code, redirect_uri, grant_type=authorization_code
 *   refresh:   POST /oauth/token grant_type=refresh_token (Refresh Token Rotation)
 *
 * Shared so the NestJS service builds the exact same URL the web app expects, and
 * so the URL construction is unit-testable without a live client.
 */
export const PENNYLANE_AUTHORIZE_URL = 'https://app.pennylane.com/oauth/authorize';
export const PENNYLANE_TOKEN_URL = 'https://app.pennylane.com/oauth/token';
export const PENNYLANE_REVOKE_URL = 'https://app.pennylane.com/oauth/revoke';
/** Space-separated scopes — read/write invoices & products for accounting sync. */
export const PENNYLANE_DEFAULT_SCOPE = 'read:invoices write:invoices read:products';

export function buildPennylaneAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(PENNYLANE_AUTHORIZE_URL);
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', opts.scope ?? PENNYLANE_DEFAULT_SCOPE);
  url.searchParams.set('state', opts.state);
  return url.toString();
}
