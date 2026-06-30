# Stripe — SaaS billing

**Status:** `stub` — schema (`core.saas_subscription`, `core.invoice`) and the
admin/billing permission exist; the API integration and webhook handler are not
yet wired. Used to bill **tenants** for the SaaS itself (M12). End-customer
mobile payments are handled by the PSP in the data repo (coordinate for
reconciliation, M2) — not here.

## Manual actions still required

- [ ] Create a Stripe account; **complete business verification** (can take
      several business days — start early).
- [ ] Create **Products & Prices** for the SaaS plans (e.g. starter / pro /
      network, per-site metering if used).
- [ ] Create a **webhook endpoint** → `POST /billing/webhook` (to be built);
      copy the **signing secret**.
- [ ] Put the secret key + webhook secret in Secrets Manager
      `pilotage/<env>/stripe`.

## Setup

1. Dashboard → Developers → API keys: copy **Secret key** (`sk_test_…` then
   `sk_live_…`).
2. Products → create plans → copy the **price IDs** (store in config/SSM).
3. Developers → Webhooks → add endpoint, select `customer.subscription.*` and
   `invoice.*` events → copy **Signing secret** (`whsec_…`).
4. Verify SCA/3DS is on (Stripe default for EU).

## Credentials / where they go

`pilotage/<env>/stripe` → `{ "secret_key": "sk_…", "webhook_secret": "whsec_…" }`.
Never store card data — Stripe tokenizes; we keep only `stripe_customer_id` /
`stripe_invoice_id`. (See [`../RGPD.md`](../RGPD.md).)

## Sandbox / test mode

Use **test mode** keys + the test card `4242 4242 4242 4242`. Stripe CLI
(`stripe listen --forward-to localhost:3000/billing/webhook`) for local webhooks.

## Contact / limits

- Support: <https://support.stripe.com>. Account verification & payout setup may
  need their team.
- Rate limits: ~100 read / 100 write req/s in live mode (test mode lower).
