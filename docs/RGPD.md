# RGPD / data protection

French laundromat operators process limited personal data (mostly operators/
staff via Cognito, and optional end-customer accounts for loyalty). This
document records the design that keeps that compliant.

## 1. Data residency

- **Single region: `eu-west-3` (Paris).** RDS, S3, Secrets Manager, Cognito,
  Lambda, logs — all in-region. No cross-region replication of personal data
  without an explicit, documented decision.
- CloudFront is global (edge caching of the **static** SPA only — no personal
  data is cached at the edge; API calls go to the regional origin).

## 2. Lawful basis & data minimization

- **Operators/staff**: legitimate interest / contract (running the service).
- **End customers** (M3, optional): consent for marketing; contract for the
  loyalty wallet they opt into.
- `core.customer` stores **minimal PII** — optional email/phone, `first_seen_at`,
  and a `consent` JSONB. No address, no marketing data unless consented.
- LLM (Mistral) prompts carry **aggregated KPIs only**, never customer PII
  (see [`providers/mistral.md`](./providers/mistral.md)).

## 3. Consent

Stored in `core.customer.consent` (JSONB), e.g.
`{ "marketing_email": true, "marketing_sms": false, "updated_at": "…" }`.
Messaging (Brevo, Web Push) checks consent before every send. Opt-out is honored
immediately and recorded.

## 4. Right to erasure (right to be forgotten)

A `DELETE /customers/:id` endpoint (M3, to build) **anonymizes** rather than hard-
deletes (to preserve financial integrity of past transactions):

1. Null/!hash the PII columns on `core.customer` (email, phone, external ids),
   set `deleted_at`.
2. Write `core.audit_log`.
3. **Emit a `customer.erased` event** (EventBridge/SQS) that the **data repo**
   subscribes to, so it purges/anonymizes derived rows in `ingest`/`analytics`
   (cycle history linked to that customer). This cross-repo event is the
   contract for end-to-end erasure.

## 5. Retention

- Telemetry/event data retention is configured in the data repo (partition drop).
- `core` audit log: retained per legal requirement (configurable), then archived.
- CloudWatch Logs: 14–30 days (parameterized) — see [`COSTS.md`](./COSTS.md).
- Backups: RDS automated backups (7–35 days, env-parameterized).

## 6. Payment data

- **No PAN / card data is ever stored.** Card payments are tokenized by the PSP
  (Stripe for SaaS billing; the end-customer PSP lives in the data repo). DSP2 /
  SCA is handled entirely by the PSP. We keep only opaque references
  (`stripe_customer_id`, `stripe_invoice_id`).

## 7. Subprocessors

| Subprocessor | Purpose | Data | Region |
|---|---|---|---|
| AWS (Cognito, RDS, Lambda, S3, …) | Hosting, auth | All (encrypted) | eu-west-3 |
| Mistral AI | LLM summaries | Aggregated KPIs (no PII) | EU (verify DPA) |
| Stripe | SaaS billing | Tenant billing contact, no PAN | EU/US (SCC) |
| Brevo | SMS/email | Customer email/phone (consented) | EU |
| Google (GBP, Could) | Reviews | Public review data | US (SCC) |

Maintain signed **DPAs** with each; this table is the register of processing.

## 8. Data-subject requests (DSR)

- **Access/portability**: export a customer's `core` data as JSON (endpoint TBD).
- **Erasure**: §4 flow.
- **Rectification**: standard update endpoints.
- Tenancy isolation (RLS) guarantees one tenant can never reach another's data
  — proven by `packages/db/src/rls.test.ts`.

## 9. Security posture (summary)

Secrets only in Secrets Manager; HTTPS only; WAF managed rules; least-privilege
IAM; RLS-enforced tenant isolation (app role is **not** `BYPASSRLS`); dependency
scanning in CI. Full controls in [`RUNBOOK.md`](./RUNBOOK.md) and `ARCHITECTURE.md`.
