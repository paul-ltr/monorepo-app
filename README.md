# Pilotage — app monorepo

Operator console + client app for a **multi-site, multi-brand ERP/SaaS for French
self-service laundromats**. One monorepo: a responsive TypeScript web app
(frontend + backend API) and all its AWS infrastructure as Terraform.
Serverless-first so idle cost stays near zero while the platform scales.

> The product UI is **French-first** (i18n FR default, EN stubbed). This repo
> owns the shared foundation infra (network, database, auth) that the companion
> **data/Python repo** consumes. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for
> the cross-repo contract.

## Stack

| Layer    | Choice |
|----------|--------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React 18 + Vite + TypeScript, Tailwind + shadcn-style UI, TanStack Router/Query, i18next, Recharts, PWA |
| Backend  | NestJS (modular, one module per domain M1–M12), Lambda-packaged via `@codegenie/serverless-express`, Fargate-ready |
| Data     | Drizzle ORM + Amazon RDS for PostgreSQL (+ RDS Proxy), Row-Level Security |
| Auth     | Amazon Cognito + app-level RBAC in the DB |
| LLM      | Mistral AI behind a swappable `LlmService` |
| IaC      | Terraform (S3+DynamoDB remote state, workspaces per env) |

## Layout

```
apps/
  web/         React + Vite SPA/PWA — the Pilotage operator console
  api/         NestJS backend (Lambda-packaged, Fargate-ready)
packages/
  shared/      shared TS types, Zod schemas, DTOs, enums, constants, errors
  db/          Drizzle schema for the `core` Postgres schema + migrations + seed
  api-client/  typed client (generated from the OpenAPI spec) consumed by web
  config/      shared tsconfig / tailwind presets
infra/
  terraform/   network, rds, cognito, web, api, events, security + remote-state
docs/          ARCHITECTURE, COSTS, RUNBOOK, RGPD, providers/*
```

## Quickstart (local, no AWS required)

Prerequisites: Node ≥ 20, pnpm (via `corepack enable`), Docker.

```bash
make bootstrap      # pnpm install + create .env from .env.example
make up             # start Postgres (docker-compose)
make db-migrate     # apply Drizzle migrations to the local DB
make db-seed        # seed roles/permissions + a demo tenant with 6 sites
make dev            # run web (http://localhost:5173) + api (http://localhost:3000)
```

`AUTH_DEV_BYPASS=true` (the default in `.env.example`) lets the API accept a dev
identity so you can use the app without a Cognito pool. The web app ships with a
typed **mock data layer** so every screen renders before the backend is wired.

## Common scripts

```bash
pnpm dev            # turbo: web + api in watch mode
pnpm build          # build every workspace
pnpm typecheck      # tsc --noEmit across the repo
pnpm lint           # eslint across the repo
pnpm test           # unit + integration tests
make tf-plan        # terraform plan for infra/terraform/envs/dev
```

## Deploy order (cross-repo)

Deploy **app first** — it creates the VPC / RDS / Cognito and publishes the
Terraform outputs (`vpc_id`, `private_subnet_ids`, `db_proxy_endpoint`,
`db_secret_arn`, …). Deploy the **data repo second**; it imports those outputs.
Details and rollback in [`docs/RUNBOOK.md`](./docs/RUNBOOK.md); cost levers in
[`docs/COSTS.md`](./docs/COSTS.md).

## Status

This is an MVP build. MVP (Must) modules are implemented; Should/Could modules
are scaffolded behind feature flags with clean boundaries. See the MoSCoW table
in [`ARCHITECTURE.md`](./ARCHITECTURE.md#5-domain-modules-moscow) and the phased
build plan in [`PLAN.md`](./PLAN.md).
