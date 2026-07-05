# Miele — machine-brand connector (3rd Party API, OAuth 2.0)

**Status:** `implemented (simulation-ready)`. Connects a tenant's **Miele@home**
account via Miele's **official** 3rd Party API so their appliances can be
retrieved and associated with a shop (site), materialising `core.machine` rows for
supervision (M1). Unlike the Electrolux connector, this uses a proper hosted OAuth
redirect — a true one-click connect with no password handling in our app. When no
client is configured the connector runs in **simulation mode** (in-app consent,
demo appliances) so the Settings screen is fully exercisable offline.

Docs: <https://developer.miele.com/docs/swagger>

## Flow

```
authorize (build consent URL + vg)            → POST /connectors/miele/authorize
  → user consents on Miele's hosted login
  → Miele redirects to the callback           → GET  /connectors/miele/callback (public)
      exchanges code → tokens, fetches devices, caches outcome
  → web returns to /settings?miele=ok&state=… → POST /connectors/miele/complete (drains + persists)
status                                        → GET  /connectors/miele/status
associate appliance → shop (creates machine)  → POST /connectors/miele/associate
disconnect                                    → POST /connectors/miele/disconnect
```

- **Authorize URL:** `https://api.mcs3.miele.com/thirdparty/login`
  (`client_id`, `response_type=code`, `redirect_uri`, `state`, `vg`)
- **Token URL:** `https://api.mcs3.miele.com/thirdparty/token`
  (`grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`)
- **Devices:** `GET https://api.mcs3.miele.com/v1/devices` (`Authorization: Bearer`,
  `Accept: application/json`) — returns an object keyed by deviceId; each carries
  `ident.type`, `ident.deviceName`, `ident.deviceIdentLabel.{fabNumber,techType}`.
- **`vg`** is the account's locale group (e.g. `fr-FR`, `de-DE`) set at Miele@home
  registration; the wrong value breaks the login. The web wizard lets the user pick it.

The URL builders and the device-type → machine_kind mapping live in
`@pilotage/shared/miele`; the NestJS `MieleService` performs the token exchange and
device fetch. Several accounts can be connected per tenant. Because the callback is
public (no tenant auth context), it only **caches** the outcome; the authed
`/complete` drains it and persists under the tenant's RLS context (mirrors Enedis).

> ℹ️ Miele is migrating the classic `thirdparty/*` endpoints to a Keycloak-based
> OAuth server (`auth.domestic.miele-iot.com/.../openid-connect`). The endpoints are
> env-overridable (`MIELE_AUTHORIZE_URL` / `MIELE_TOKEN_URL` / `MIELE_API_BASE`), so
> the new URLs (and the `openid mcs_thirdparty_read/write/media` scopes) can be
> swapped in without code changes when the classic ones are retired.

## Storage (so the data repo can keep syncing)

- **`core.connector_config`** — one row per account (`kind='machine_brand'`,
  `provider='miele'`, `config` jsonb with label/vg/appliance ids, `secret_ref`,
  `status`), exposed via `core.v_connector_config`.
- **`core.machine`** — each associated appliance (`brand='miele'`,
  `external_ref`=deviceId, `serial`=fabNumber), via the existing `core.v_machine` view.
- **Refresh token** — held via `SecretStore` at `secret_ref`; the DB only stores
  the ref. The data repo reads `secret_ref` and fetches the token from Secrets Manager.

## Manual actions still required

- [ ] Register an application on <https://developer.miele.com> and note the
      **client_id** / **client_secret**.
- [ ] Whitelist the redirect URI `${API_PUBLIC_URL}/connectors/miele/callback`.
- [ ] Set `MIELE_CLIENT_ID` / `MIELE_CLIENT_SECRET` (via Secrets Manager
      `pilotage/<env>/miele` in staging/prod).
- [ ] Wire `SecretStore` to AWS Secrets Manager in prod (shared with the other
      connectors — see `apps/api/src/modules/secret-store.service.ts`).
- [ ] When Miele retires the classic endpoints, point `MIELE_AUTHORIZE_URL` /
      `MIELE_TOKEN_URL` at the Keycloak OAuth server and add the required scopes.
