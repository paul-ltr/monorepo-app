# Pennylane — accounting connector (OAuth 2.0)

**Status:** `implemented (sandbox-ready)`. Connects a tenant's Pennylane company
so accounting exports (FEC / journals, M6) can sync. Uses the Pennylane Company
API **OAuth 2.0 authorization-code** flow. When no client is configured the
connector runs in **simulation mode** (self-issued consent, no live token
exchange) so the Finances screen is fully exercisable offline.

Docs: <https://pennylane.readme.io/docs/oauth-20-walkthrough>

## Flow

```
authorize (build consent URL)                → POST /connectors/pennylane/authorize
  → user consents on app.pennylane.com
  → Pennylane redirects to the callback      → GET  /connectors/pennylane/callback (public)
      exchanges code → tokens, stores conn
  → web returns to /finances?pennylane=ok    → GET  /connectors/pennylane/status
disconnect                                    → POST /connectors/pennylane/disconnect
```

- **Authorize URL:** `https://app.pennylane.com/oauth/authorize`
  (`client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`)
- **Token URL:** `https://app.pennylane.com/oauth/token`
  (`client_id`, `client_secret`, `code`, `redirect_uri`, `grant_type=authorization_code`)
- Refresh uses **Refresh Token Rotation** (`grant_type=refresh_token`): each refresh
  invalidates the old refresh token and returns a new one.

The URL builder and endpoint constants live in `@pilotage/shared/pennylane` so the
web app and the NestJS `PennylaneService` construct the exact same request.

## Manual actions still required

- [ ] Create a Pennylane account and an **OAuth application**
      (<https://app.pennylane.com>).
- [ ] Whitelist the redirect URI `${API_PUBLIC_URL}/connectors/pennylane/callback`.
- [ ] Note the **client_id** / **client_secret**; set `PENNYLANE_CLIENT_ID` /
      `PENNYLANE_CLIENT_SECRET` (via Secrets Manager `pilotage/<env>/pennylane` in
      staging/prod).
- [ ] Choose scopes (`PENNYLANE_SCOPE`, space-separated). Default:
      `read:invoices write:invoices read:products`.

## Credentials / where they go

`pilotage/<env>/pennylane` → `{ "client_id": "…", "client_secret": "…" }`. The
refresh token is held per-tenant server-side (in-memory in the current build; a
production build persists it encrypted and rotates it — see `PennylaneService`).
