# Electrolux — machine-brand connector (OneApp / OCP)

**Status:** `implemented (simulation-ready)`. Connects a tenant's Electrolux (or
AEG) **group account** so their appliances can be retrieved and associated with a
shop (site), materialising `core.machine` rows for supervision (M1). When
`ELECTROLUX_ENABLED=false` (default) the connector runs in **simulation mode**
(demo appliances, no live login) so the Settings screen is fully exercisable
offline.

> ⚠️ **Unofficial API.** This uses the consumer **OneApp / OCP** API
> (`api.ocp.electrolux.one`) — the same one the Electrolux OneApp mobile app uses,
> reverse-engineered by [`Woyken/py-electrolux-ocp`]. It is **not** the public
> `developer.electrolux.one` developer API (which has no hosted OAuth redirect for
> third parties and only issues per-account API keys + refresh tokens manually in a
> portal). The consumer API is ToS-sensitive and its hard-coded client constants
> can change; they are overridable via env. Chosen for the true "connect from the
> app in one click" (email + password) experience.

[`Woyken/py-electrolux-ocp`]: https://github.com/Woyken/py-electrolux-ocp

## Flow

```
connect (email + password + country)          → POST /connectors/electrolux/connect
  1. client-credentials token                    POST {base}/one-account-authorization/api/v1/token
  2. identity providers (Gigya domain + region)  GET  {base}/one-account-user/api/v1/identity-providers
  3. Gigya (SAP CDC) login → id_token            socialize.getIDs → accounts.login → accounts.getJWT (HMAC-SHA1)
  4. token exchange → access + refresh token     POST {region}/one-account-authorization/api/v1/token
  5. list appliances (+ metadata)                GET  {region}/appliance/api/v2/appliances
status                                          → GET  /connectors/electrolux/status
associate appliance → shop (creates a machine)  → POST /connectors/electrolux/associate
disconnect                                      → POST /connectors/electrolux/disconnect
```

The OCP/Gigya endpoint builders and the OAuth1 base-string helper live in
`@pilotage/shared/electrolux`; the `ElectroluxService` (NestJS) performs the HMAC
signing (`node:crypto`) and the HTTP calls. Several accounts can be connected per
tenant.

## Storage (so the data repo can keep syncing)

- **`core.connector_config`** — one row per account: `kind='machine_brand'`,
  `provider='electrolux'`, `config` jsonb (label, brand, country, region base URL,
  appliance ids/count), `secret_ref`, `status`. Exposed to the data repo via the
  `core.v_connector_config` view.
- **`core.machine`** — each associated appliance (`brand='electrolux'`,
  `external_ref`=applianceId, `serial`), visible via the existing `core.v_machine`
  view.
- **Refresh token** — the durable secret. Held via `SecretStore` at `secret_ref`;
  the DB only ever stores the ref (per ARCHITECTURE §connectors). The data repo
  reads `secret_ref` and fetches the token from Secrets Manager.

## Manual actions still required

- [ ] Set `ELECTROLUX_ENABLED=true` to allow real logins (staging/prod).
- [ ] Wire `SecretStore` to **AWS Secrets Manager** in prod (the seam is in
      `apps/api/src/modules/secret-store.service.ts`; add
      `@aws-sdk/client-secrets-manager`). Dev keeps the token in-process.
- [ ] If the OneApp client constants rotate, override `ELECTROLUX_API_KEY` /
      `ELECTROLUX_CLIENT_SECRET` (and update `@pilotage/shared/electrolux`).
- [ ] Confirm the legal/ToS position of using the consumer OneApp API before a
      production launch; migrate to the official developer API if a supported path
      appears.
