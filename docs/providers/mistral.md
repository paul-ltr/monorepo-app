# Mistral AI — LLM

**Status:** `wired` — `LlmService` (apps/api) wraps the chat API behind a stable,
swappable interface. It **resolves a key automatically** and goes live the moment
one is present; with no key it falls back to **stub mode** (deterministic canned
response, no network). Powers the **agentic LavoPilot chat** (`AgentService`),
dashboard **synthèses IA** (M1/M9), energy/anomaly narration (M5), and CRM copy (M8).

## Key resolution (in order)

1. **`MISTRAL_API_KEY`** env var — local dev fallback (`.env`).
2. **`MISTRAL_SECRET_ID`** env var — explicit Secrets Manager path override.
3. **`pilotage/<PILOTAGE_ENV>/mistral`** — the default container created by the
   security Terraform module; the API Lambda already has `GetSecretValue` on it,
   so **no infra change is needed** — just set the secret's value.

The secret value may be a **raw key string** or a JSON blob
(`{"api_key": "…"}` — also accepts `apiKey` / `key`). Fetches are cached ~5 min.

## Manual actions still required

- [ ] Create a Mistral account at <https://console.mistral.ai>.
- [ ] Generate an **API key**.
- [ ] Put it in Secrets Manager as `pilotage/<env>/mistral` (key `api_key`).
- [ ] **Confirm current model names** from <https://docs.mistral.ai> before
      pinning — this repo defaults to the aliases `mistral-small-latest` (cheap
      tasks) and `mistral-large-latest` (reasoning); these are *aliases that
      track the latest version* and should be re-checked at provisioning time.
- [ ] Set the per-tenant monthly cap `LLM_TENANT_MONTHLY_TOKEN_CAP` (default 2M).

## Cost & safety design (already in code)

- **Two models**: small for summaries, large for NL Q&A over KPIs.
- **Per-tenant token cap** enforced in `LlmService` (raises `rate_limited` /
  429 when exceeded). Counter is in-memory in the MVP — TODO: persist to `core`.
- **Caching**: identical prompts should be cached (TODO) to cut cost.
- **PII minimization**: send only aggregated KPIs, never customer PII.
- **Token usage is logged** per tenant for cost allocation.

## Credentials / where they go

`pilotage/<env>/mistral` → `{ "api_key": "..." }` in Secrets Manager. The Lambda
role is granted `secretsmanager:GetSecretValue` on that ARN only. Never in repo.

## Sandbox / limits / pricing

- No separate sandbox; use a low cap + the small model while testing.
- Rate limits and pricing are plan-dependent — see the Mistral console/pricing
  page (could not be verified here; check at setup).

## Contact

- Docs/support: <https://docs.mistral.ai> · <https://help.mistral.ai>.
- For volume commitments or higher rate limits, contact Mistral sales.
