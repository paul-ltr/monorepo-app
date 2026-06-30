# Brevo — SMS / email

**Status:** `planned`. Transactional + marketing SMS/email to **customers**
(end-of-cycle alerts, loyalty, churn reactivation) for M3/M8. Sent from SQS
consumers (see `infra` events), never inline in a request.

## Manual actions still required

- [ ] Create a Brevo account (<https://www.brevo.com>).
- [ ] Generate an **API v3 key**.
- [ ] **Email**: authenticate the sending domain (SPF + DKIM DNS records).
- [ ] **SMS in France**: register/validate an **alphanumeric sender** (sender ID).
      Operator validation has a **lead time of several days** — start early. Note
      alphanumeric senders can't receive replies; use a short code if two-way is
      needed.
- [ ] Put the key in Secrets Manager `pilotage/<env>/brevo`.

## Setup

1. Brevo → SMTP & API → API keys → create (v3).
2. Senders & domains → add + verify the email domain (DNS).
3. Senders & domains → SMS senders → request the sender ID (provide company docs;
   wait for validation).
4. Respect opt-in: only message customers whose `core.customer.consent` allows it.

## Credentials / where they go

`pilotage/<env>/brevo` → `{ "api_key": "xkeysib-…" }`. The web-push and email
templates live in the data/app config, not the secret.

## Sandbox / limits / pricing

- No true sandbox; test with your own number/email and a tiny volume.
- SMS is priced per message per country; email has monthly tiers. Check Brevo
  pricing at setup (not verified here).
- Respect French marketing rules (consent, opt-out, quiet hours).

## Contact

Support via the Brevo dashboard; sales for SMS volume / sender registration help.
