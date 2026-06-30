# Costs

Serverless-first so **idle cost stays near zero** and cost scales with usage.
Figures below are rough monthly **ballparks** in `eu-west-3`, USD (≈ EUR), to
reason about levers — not a quote. Verify against the AWS pricing calculator.

## Idle / MVP (dev, very low traffic)

| Item | Config | ~$/mo |
|---|---|---|
| RDS PostgreSQL | `db.t4g.small`, single-AZ, gp3 20 GB | ~$25–35 |
| RDS Proxy | always-on | ~$10–15 |
| NAT (egress) | **fck-nat** t4g.nano Spot (not managed NAT GW) | ~$3–5 |
| Lambda (API) | scale-to-zero, low invocations | ~$0–1 |
| API Gateway HTTP | per-request | ~$0–1 |
| S3 + CloudFront | static SPA, low traffic | ~$1–3 |
| Secrets Manager | ~5 secrets | ~$2–3 |
| CloudWatch | 14–30d retention | ~$2–5 |
| Cognito | < 50k MAU free tier | ~$0 |
| **Total idle** | | **≈ $45–70 / mo** |

The single biggest idle cost is **RDS** (the one always-on component). Everything
else scales to ~zero.

## Per +1,000 active sites (incremental)

Dominated by **data volume** (telemetry lives in the data repo) and **read
traffic**, not the app tier:

| Driver | Effect |
|---|---|
| API/Lambda + API GW | a few $ per millions of requests — negligible until high traffic |
| RDS | may need `db.t4g.medium`/`large` + Multi-AZ for prod → ~$150–400/mo |
| CloudFront/S3 | grows with app loads — still single-digit $ at this scale |
| LLM (Mistral) | **capped per tenant** (`LLM_TENANT_MONTHLY_TOKEN_CAP`); the main variable AI cost — keep summaries on the small model + cache |
| SMS (Brevo) | per-message; only on consented sends — can dominate if abused, so gate it |

Realistically a few hundred $/mo for a healthy multi-hundred-site network on
prod-sized RDS, plus usage-based AI/SMS.

## Levers (ordered by impact)

1. **RDS sizing & Multi-AZ** — biggest lever. Dev: small/single-AZ. Prod: size to
   load, enable Multi-AZ only where the SLA needs it. (`rds` module vars.)
2. **NAT mode** — fck-nat instance (dev) vs managed NAT Gateway (prod). A managed
   NAT GW alone is ~$32/mo + data; fck-nat is ~$3–5. (`network` `use_managed_nat`.)
3. **VPC endpoints** — S3 gateway + interface endpoints (Secrets Manager, ECR,
   Logs) keep AWS-API egress **off** the NAT path → less NAT data cost.
4. **Lambda scale-to-zero** — no provisioned concurrency at MVP (cold starts are
   acceptable for an internal console). Turn it on per-function only if needed.
5. **CloudWatch retention** — 14–30 days (parameterized). Don't keep logs forever.
6. **LLM cost cap + caching + small model** — keep AI spend bounded and predictable.
7. **Tag everything** (`project=pilotage`, `repo=app`, `env`, `module`) and watch
   a **Budgets + Cost Anomaly** alarm (`security` module).

## Notes

- RDS is **shared with the data repo** — its cost is split/attributed across both
  repos; size it for the combined workload.
- These exclude data-transfer spikes and any reserved-instance/savings-plan
  discounts (which would lower RDS materially for steady prod).
