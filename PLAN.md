# Build plan — Pilotage app monorepo

Commit per phase; keep the repo green (typecheck + lint + tests). The product UI
is French-first. Status legend: ✅ done · 🔜 next · ⬜ planned.

## Foundation (this is "Phase 1 & 2")
- ✅ **P0 — Scaffold**: pnpm + Turborepo, tsconfig/eslint/prettier, docker-compose
  (Postgres), `@pilotage/config` design tokens, README/ARCHITECTURE.
- ✅ **P1 — `@pilotage/shared`**: enums, money, RFC-7807 errors, RBAC catalog,
  feature flags, Zod DTOs for every screen. Typecheck + vitest green.
- ✅ **P2 — `@pilotage/db`**: full `core` Drizzle schema, SQL bootstrap (uuidv7,
  roles), migrations, RLS policies + reference views, seed (demo tenant, 6 sites).
  Verified: migrate + seed + **RLS isolation test green**.

## Remaining 9 phases
- 🔜 **P3 — `@pilotage/api-client`**: the `PilotageApi` interface, an HTTP client
  (Bearer auth) and an in-browser **mock client** backed by typed fixtures that
  mirror the design data. Unblocks the web app before the backend exists.
- ⬜ **P4 — `apps/web` (the Claude Design layout)**: Vite + React 18 + Tailwind
  (tokens) + TanStack Router/Query + i18next (FR) + Recharts + PWA. Build the
  role-aware shell (dark sidebar, topbar, scope selector) and all design screens
  (Dashboard, Machines + drawer, Énergie/OPERAT, Recettes/réconciliation,
  Maintenance, Tarifs, Clients, Finances, Réseau, Paramètres, Notifications) with
  loading/empty/error/offline states, white-label theming, a11y. **The primary ask.**
- ⬜ **P5 — `apps/api` core**: NestJS + Lambda adapter; Cognito-or-dev-bypass auth
  guard → request context; per-request RLS GUCs (`withTenantContext`); RBAC
  guards; Zod validation pipe; RFC-7807 errors; pino logs + audit; OpenAPI;
  `LlmService` (Mistral) with rate-limit + per-tenant cost cap; `/health`.
- ⬜ **P6 — MVP API modules**: M1 (status/history/SSE), M2 (revenue + reconciliation
  + cash), M5 (energy + OPERAT report), M9 (multi-site + benchmark + RBAC by
  scope), M12 (tenants/users/roles/sites/connectors/audit/billing). Reads off
  `ingest`/`analytics` (mocked locally until the data repo exists). Web flips from
  mock client → HTTP client.
- ⬜ **P7 — `infra/terraform`**: remote-state bootstrap → network (VPC, endpoints,
  fck-nat) → rds (+ proxy, bootstrap SQL) → cognito → security (Secrets/KMS/WAF/
  alarms) → web (S3+CloudFront) → api (Lambda+API GW) → events (SQS/EventBridge).
  Per-env roots (dev/staging/prod); export the cross-repo outputs. `tf validate`.
- ⬜ **P8 — CI/CD**: GitHub Actions — PR (lint/typecheck/test/build/`tf plan`) and
  main (build+deploy web, package api Lambda, gated `tf apply`, DB migrate, smoke).
  OIDC to AWS, per-env workflows.
- ⬜ **P9 — Docs**: `docs/providers/*` (Cognito, Mistral, Stripe, Brevo, Web Push,
  Google Business Profile) each with a "manual actions" checklist + status;
  `docs/RGPD.md` (residency, consent, right-to-erasure event), `RUNBOOK.md`,
  `COSTS.md`.
- ⬜ **P10 — Should/Could scaffolding**: stub M3/M4/M6/M7/M8 + remote actions
  (`device_command`) behind feature flags, with typed boundaries, TODOs and tests.
- ⬜ **P11 — Quality gate**: Playwright e2e on critical flows (login, dashboard,
  reconciliation, OPERAT, client launch-and-pay), axe a11y, coverage on MVP paths,
  final DoD verification.

## Definition of done (MVP) — tracked
One command brings web+api+pg up with seeded demo data · `terraform apply` to dev
provisions the stack and publishes cross-repo outputs · a user can sign in → see
multi-site dashboard with live status → drill into a machine → revenue +
reconciliation → energy + generate OPERAT → manage users/roles/sites/connectors →
audit log · **RLS proven** (✅) · CI green · provider docs + COSTS + ARCHITECTURE
complete · Should/Could present as flagged stubs.
