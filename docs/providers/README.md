# Providers & integrations

Every external provider this repo integrates is documented here with exact
manual setup steps, where credentials go, who to contact, and implementation
status. **Secrets never live in the repo** — they go in AWS Secrets Manager
under `pilotage/<env>/<provider>` (see [`../RUNBOOK.md`](../RUNBOOK.md#secrets)).

> Machine & payment-central providers (LM Control, EAS, Speed Queen, Girbau,
> Myosis, …) are integrated in the **data/Python repo**, not here — the app
> talks to them only through the `core.device_command` queue and reads their
> telemetry from `ingest`/`analytics`. Cross-link: see the data repo's
> `docs/providers/`.

## Index

| Provider | Used for | Module(s) | Status | Secret name |
|---|---|---|---|---|
| [Amazon Cognito](./cognito.md) | Auth (JWT) | M12 | `implemented` | — (pool IDs in SSM) |
| [Mistral AI](./mistral.md) | LLM summaries / Q&A / CRM copy | M1, M5, M8, M9 | `stub` | `pilotage/<env>/mistral` |
| [Stripe](./stripe.md) | SaaS subscription billing | M12 | `stub` | `pilotage/<env>/stripe` |
| [Brevo](./brevo.md) | SMS / email to customers | M3, M8 | `planned` | `pilotage/<env>/brevo` |
| [Web Push](./web-push.md) | End-of-cycle push (client app) | M3 | `planned` | `pilotage/<env>/webpush` |
| [Google Business Profile](./google-business-profile.md) | Reviews | M8 (Could) | `planned` | `pilotage/<env>/gbp` |

`implemented` = code path exists & exercised · `stub` = wrapper exists, key not
provisioned · `planned` = designed, not built.

## Manual actions still required (consolidated)

- [ ] **Cognito** — create the user pool + app client per env; put IDs in SSM; map
      groups → app roles (the seed already defines the roles).
- [ ] **Mistral** — create an account, generate an API key, put it in Secrets
      Manager; confirm current model names from <https://docs.mistral.ai>.
- [ ] **Stripe** — complete account verification (can take days), create products/
      prices for the SaaS plans, set the webhook secret.
- [ ] **Brevo** — create an account; for **SMS in France** register a sender ID /
      complete sender validation (lead time — start early).
- [ ] **Web Push** — generate a VAPID key pair; store private key as a secret.
- [ ] **Google Business Profile** — request Business Profile API access (approval
      lead time); configure OAuth consent.

See each provider page for the detailed checklist.
