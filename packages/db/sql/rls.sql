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
    'connector_config','device_command','notification','audit_log'
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

grant usage on schema core to data_rw;
grant select on core.v_tenant, core.v_site, core.v_machine, core.v_price_effective to data_rw;
