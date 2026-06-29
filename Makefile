# Pilotage — app monorepo. Convenience targets over pnpm/turbo/terraform.
# Usage: `make <target>`. Run `make help` for the list.

SHELL := /bin/bash
TF_DIR ?= infra/terraform/envs/dev

.DEFAULT_GOAL := help

.PHONY: help bootstrap dev up down db-generate db-migrate db-seed \
        test lint typecheck build format tf-init tf-plan tf-apply deploy clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install dependencies and prepare local env
	corepack enable
	pnpm install
	@test -f .env || cp .env.example .env
	@echo "✓ bootstrap complete — run 'make up' then 'make dev'"

up: ## Start local infra (Postgres [+ LocalStack]) via docker-compose
	docker compose up -d

down: ## Stop local infra
	docker compose down

dev: ## Run web + api in watch mode
	pnpm dev

db-generate: ## Generate Drizzle SQL migrations from the schema
	pnpm db:generate

db-migrate: ## Apply migrations to the local database
	pnpm db:migrate

db-seed: ## Seed roles/permissions + demo tenant
	pnpm db:seed

test: ## Run all tests
	pnpm test

lint: ## Lint all workspaces
	pnpm lint

typecheck: ## Type-check all workspaces
	pnpm typecheck

build: ## Build all workspaces
	pnpm build

format: ## Format the repo with Prettier
	pnpm format

tf-init: ## terraform init for $(TF_DIR)
	cd $(TF_DIR) && terraform init

tf-plan: ## terraform plan for $(TF_DIR)
	cd $(TF_DIR) && terraform plan

tf-apply: ## terraform apply for $(TF_DIR)
	cd $(TF_DIR) && terraform apply

deploy: build ## Build then deploy (see docs/RUNBOOK.md for the gated CD path)
	@echo "Deploys run through GitHub Actions (OIDC). See docs/RUNBOOK.md."

clean: ## Remove build artifacts and node_modules
	pnpm clean
