-- ===========================================================================
-- Row-Level Security for `core`. Run AFTER Drizzle migrations (tables must
-- exist). Every tenant-scoped table is filtered by current_setting(
-- 'app.current_tenant') which the API sets per request (see withTenantContext).
-- app_rw is not BYPASSRLS, so this is the hard tenant-isolation guarantee
-- (EF-M12-01). FORCE makes the policy apply to the table owner too; superusers
-- still bypass (used by migrations/seed only).
-- ===========================================================================

-- core schema is created by the first migration; grant app_rw access now and
-- set default privileges so future migrations' tables are covered too.
grant usage on schema core to app_rw;
grant usage on schema core to data_rw;
alter default privileges in schema core
  grant select, insert, update, delete on tables to app_rw;
alter default privileges in schema core
  grant usage, select on sequences to app_rw;
grant select, insert, update, delete on all tables in schema core to app_rw;
grant usage, select on all sequences in schema core to app_rw;

-- --- Uniform policy: tables that carry tenant_id ----------------------------
do $$
declare
  t text;
  uniform text[] := array[
    'network','tenant_branding','site','app_user',
    'payment_central','machine','program',
    'price_plan','price','promotion',
    'customer','wallet','loyalty_account','loyalty_transaction',
    'customer_subscription','segment','campaign',
    'technician','maintenance_ticket','ticket_event','maintenance_plan',
    'part','part_usage',
    'charge','accounting_export','accounting_connector',
    'saas_subscription','invoice',
    'connector_config','device_command','notification','audit_log',
    'support_ticket','support_message'
  ];
begin
  foreach t in array uniform loop
    execute format('alter table core.%I enable row level security', t);
    execute format('alter table core.%I force row level security', t);
    execute format('drop policy if exists tenant_isolation on core.%I', t);
    execute format(
      'create policy tenant_isolation on core.%I '
      'using (tenant_id = current_setting(''app.current_tenant'', true)::uuid) '
      'with check (tenant_id = current_setting(''app.current_tenant'', true)::uuid)',
      t
    );
  end loop;
end
$$;

-- --- Special cases ----------------------------------------------------------
-- tenant: keyed by id, not tenant_id.
alter table core.tenant enable row level security;
alter table core.tenant force row level security;
drop policy if exists tenant_isolation on core.tenant;
create policy tenant_isolation on core.tenant
  using (id = current_setting('app.current_tenant', true)::uuid)
  with check (id = current_setting('app.current_tenant', true)::uuid);

-- role: tenant roles + shared system roles (tenant_id is null).
alter table core.role enable row level security;
alter table core.role force row level security;
drop policy if exists tenant_isolation on core.role;
create policy tenant_isolation on core.role
  using (tenant_id is null or tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- user_role: no tenant_id — gate through the owning app_user.
alter table core.user_role enable row level security;
alter table core.user_role force row level security;
drop policy if exists tenant_isolation on core.user_role;
create policy tenant_isolation on core.user_role
  using (
    exists (
      select 1 from core.app_user u
      where u.id = user_role.user_id
        and u.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

-- royalty_rule / royalty_invoice: gate through the owning network's tenant.
do $$
declare t text;
begin
  foreach t in array array['royalty_rule','royalty_invoice'] loop
    execute format('alter table core.%I enable row level security', t);
    execute format('alter table core.%I force row level security', t);
    execute format('drop policy if exists tenant_isolation on core.%I', t);
    execute format(
      'create policy tenant_isolation on core.%I using (exists ('
      'select 1 from core.network n where n.id = core.%I.network_id '
      'and n.tenant_id = current_setting(''app.current_tenant'', true)::uuid))',
      t, t
    );
  end loop;
end
$$;

-- permission + role_permission are shared catalog (no tenant data): readable.
grant select on core.permission, core.role_permission to app_rw;

-- ===========================================================================
-- Stable reference views for the data repo (versioned; don't break columns).
-- Owned by the migration role → bypass RLS so the data repo (data_rw) can read
-- reference data across tenants for ingestion/analytics.
-- ===========================================================================
create or replace view core.v_tenant as
  select id, name, type, status, locale from core.tenant;

create or replace view core.v_site as
  select id, tenant_id, network_id, name, city, postal_code, lat, lng,
         surface_m2, timezone, status
  from core.site
  where deleted_at is null;

create or replace view core.v_machine as
  select id, tenant_id, site_id, central_id, kind, brand, model, serial,
         capacity_kg, status
  from core.machine;

create or replace view core.v_price_effective as
  select p.id, p.tenant_id, p.price_plan_id, p.program_id, p.machine_kind,
         p.slot, p.amount_cents, p.currency
  from core.price p
  join core.price_plan pp on pp.id = p.price_plan_id
  where pp.active
    and (p.valid_from is null or p.valid_from <= now())
    and (p.valid_to is null or p.valid_to >= now());

-- Connector registry (Electrolux/energy/accounting/...). The data repo reads
-- this to know which provider accounts to pull from; `secret_ref` points at the
-- Secrets Manager entry holding the actual token (the secret is never in the DB).
create or replace view core.v_connector_config as
  select id, tenant_id, site_id, kind, provider, status, secret_ref, last_sync_at
  from core.connector_config;

grant usage on schema core to data_rw;
grant select on core.v_tenant, core.v_site, core.v_machine, core.v_price_effective,
                core.v_connector_config to data_rw;

-- ===========================================================================
-- Cross-tenant views for the LavoPilot back-office console (M12). Owned by the
-- migration role → bypass RLS, so a superuser (app_rw) can read across tenants.
-- Writes still go through the RLS-scoped base tables (tenant-scoped per row).
-- ===========================================================================
create or replace view core.v_app_user as
  select u.id, u.tenant_id, t.name as tenant_name, u.email, u.full_name,
         u.status, u.last_login_at, u.created_at,
         coalesce(
           (select r.key from core.user_role ur
              join core.role r on r.id = ur.role_id
             where ur.user_id = u.id
             order by array_position(
               array['owner','manager','accountant','technician','viewer']::text[], r.key)
             limit 1),
           'viewer') as role
  from core.app_user u
  join core.tenant t on t.id = u.tenant_id;

create or replace view core.v_support_ticket as
  select st.id, st.tenant_id, t.name as tenant_name, st.ref, st.subject,
         st.requester_name, st.requester_email, st.status, st.priority,
         st.category, st.created_at, st.updated_at
  from core.support_ticket st
  join core.tenant t on t.id = st.tenant_id;

create or replace view core.v_support_message as
  select id, tenant_id, ticket_id, author_name, author_role, body, created_at
  from core.support_message;

-- Group (tenant) registry with SaaS billing + rollup counts, cross-tenant.
create or replace view core.v_group as
  select t.id, t.name, t.status,
         coalesce(sub.plan, 'starter') as plan,
         coalesce(sub.status, 'trialing') as billing_status,
         (select count(*) from core.site si
            where si.tenant_id = t.id and si.deleted_at is null) as sites_count,
         (select count(*) from core.app_user u where u.tenant_id = t.id) as users_count,
         (select u2.email from core.app_user u2
            join core.user_role ur on ur.user_id = u2.id
            join core.role r on r.id = ur.role_id and r.key = 'owner'
           where u2.tenant_id = t.id
           limit 1) as owner_email,
         t.created_at
  from core.tenant t
  left join core.saas_subscription sub on sub.tenant_id = t.id;

-- The console runs as app_rw; these views bypass RLS by their owner.
grant select on core.v_app_user, core.v_support_ticket, core.v_support_message, core.v_group to app_rw;
