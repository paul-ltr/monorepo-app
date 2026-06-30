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
- ✅ **P5 — `apps/api` core**: NestJS + Lambda adapter; Cognito-or-dev-bypass
  AuthMiddleware → ALS request context; per-request RLS GUCs (`ScopedDb` →
  `withTenantContext`); RBAC guard + `@RequirePermission`; Zod validation pipe;
  RFC-7807 problem filter; audit writes; OpenAPI (`/docs`); swappable
  `LlmService` (Mistral) with per-tenant token cap; `/health`. **Verified
  end-to-end** against the seeded DB: `/me`, `/sites` (RLS-scoped read),
  `/dashboard` (RBAC), `POST /energy/operat` (write + audit row), 422 on bad input.
- 🔜 **P6 — MVP API modules**: ✅ read endpoints for M1/M2/M5/M9/M12 wired (served
  from typed fixtures = the "mock `ingest`/`analytics`" the spec calls for, with
  TODOs to swap for `analytics.*` queries once the data repo lands) + DB-backed
  `/me`/`/branding`/`/sites` + OPERAT generate. ⬜ remaining: SSE live feed,
  machine CRUD, refund/ticket writes, connectors mutations. Web flips mock→HTTP
  via `VITE_USE_MOCKS=false` + `VITE_API_BASE_URL` (no code change).
- ✅ **P7 — `infra/terraform`**: remote-state bootstrap + 7 modules (network with
  VPC endpoints + fck-nat/managed-NAT toggle, rds with RDS Proxy + Secrets +
  bootstrap placeholder, cognito, security with KMS/secrets/WAF/budget/alarms,
  web S3+CloudFront OAC, api Lambda+API GW with a Fargate migration path, events
  SQS/EventBridge) + per-env roots (dev/staging/prod) exporting the cross-repo
  outputs. Written by hand (Terraform not installable here → can't `validate`
  locally; CI runs fmt+validate). Internally cross-checked: every `module.x.y`
  reference resolves to a declared output, every module input is satisfied.
- ✅ **P8 — CI/CD**: GitHub Actions — `ci.yml` (lint/typecheck/test/build with a
  Postgres service + `tf fmt`/`validate`) and `deploy.yml` (env-gated OIDC deploy:
  `tf apply` → migrate → web S3+CloudFront → api Lambda → smoke). Verified the CI
  task graph (lint/typecheck/test/build) is green locally.
- ✅ **P9 — Docs**: `docs/providers/*` (Cognito/Mistral/Stripe/Brevo/Web Push/GBP)
  each with manual-actions checklist + status; `docs/RGPD.md` (residency, consent,
  right-to-erasure cross-repo event, no PAN), `RUNBOOK.md`, `COSTS.md`.
- 🔜 **P10 — Should/Could scaffolding**: feature flags + module boundaries exist in
  `@pilotage/shared`; web reads via flags. Remaining: explicit 501 `feature_disabled`
  stub endpoints for non-MVP modules + the `device_command` remote-action write path.
- ✅ **P11 — Quality gate**: RLS isolation test (db), RBAC-guard + Zod-pipe unit
  tests (api), money/flags/rbac tests (shared), and a **web render + axe-a11y test**
  (Revenue/M2 against the mock client in jsdom) that also proves the React app
  paints the design — closing the live-preview gap. `pnpm test` 6/6 green in CI.
  Remaining (nice-to-have): full-browser Playwright e2e (heavy browser download)
  for the end-to-end click-through.

## Definition of done (MVP) — tracked
One command brings web+api+pg up with seeded demo data · `terraform apply` to dev
provisions the stack and publishes cross-repo outputs · a user can sign in → see
multi-site dashboard with live status → drill into a machine → revenue +
reconciliation → energy + generate OPERAT → manage users/roles/sites/connectors →
audit log · **RLS proven** (✅) · CI green · provider docs + COSTS + ARCHITECTURE
complete · Should/Could present as flagged stubs.
