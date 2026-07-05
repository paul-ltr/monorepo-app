-- ===========================================================================
-- Pilotage — DB bootstrap. Run ONCE per database, before Drizzle migrations.
--   * locally: mounted into docker-entrypoint-initdb.d (see docker-compose.yml)
--   * in AWS: executed by Terraform (rds module) right after the instance is up
-- Owns: extensions, the uuidv7() generator, and the app_rw/data_rw roles +
-- default privileges. DDL for `core` tables lives in Drizzle migrations;
-- `core` itself is created by the first migration. ingest/analytics DDL belongs
-- to the data repo.
-- ===========================================================================

create extension if not exists pgcrypto;          -- gen_random_uuid()
create extension if not exists pg_stat_statements; -- query observability

-- --- Schemas ----------------------------------------------------------------
-- `core` is created by the first Drizzle migration (it owns that schema's DDL).
-- We only pre-create the data repo's schemas so SELECT grants can be set up.
create schema if not exists ingest;     -- data repo owns DDL; app gets SELECT
create schema if not exists analytics;  -- data repo owns DDL; app gets SELECT

-- --- UUIDv7 (time-ordered, index-friendly) ----------------------------------
-- Daniel Vérité's implementation: take a v4 uuid (correct variant bits already),
-- overlay a millisecond timestamp into the first 48 bits, then set version 7.
create or replace function uuidv7() returns uuid as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$ language sql volatile;

-- --- Application roles -------------------------------------------------------
-- Dev passwords only; in AWS the credentials come from Secrets Manager and the
-- roles are created without LOGIN passwords in the clear. app_rw is NOT
-- BYPASSRLS — that is the hard guarantee of tenant isolation.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_rw') then
    create role app_rw login password 'app_rw';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'data_rw') then
    create role data_rw login password 'data_rw';
  end if;
end
$$;

-- app_rw: SELECT on ingest/analytics (core grants happen post-migration in rls.sql).
grant usage on schema ingest, analytics to app_rw;
alter default privileges in schema ingest
  grant select on tables to app_rw;
alter default privileges in schema analytics
  grant select on tables to app_rw;

-- data_rw: RW on ingest/analytics, plus CREATE so the data repo's Alembic owns
-- and creates the tables in those schemas (it runs the only DDL there).
grant usage, create on schema ingest, analytics to data_rw;
alter default privileges in schema ingest grant all on tables to data_rw;
alter default privileges in schema analytics grant all on tables to data_rw;
