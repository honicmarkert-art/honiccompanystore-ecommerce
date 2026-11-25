-- =====================================================================================
-- RLS lockdown — 2026-11-22
--
-- Findings from the live review (Management API, read-only queries):
--   * profiles  SELECT policy "profiles_select_is_active_own" ended in "OR true"  -> everyone could read
--     every profile (names, emails, phones, TIN/NIDA). It also treated users as admin based on
--     auth.users.raw_user_meta_data->>'role', which users can set themselves at sign-up.
--   * profiles  UPDATE "own profile" policies had no column limits -> any user could set is_admin = true.
--   * orders / order_items / cart_items had "system" policies using (auth.uid() IS NULL). That is TRUE for
--     every anonymous visitor (the service-role key bypasses RLS anyway), so anonymous visitors could read
--     all orders, and insert/update/delete order_items and cart_items.
--   * product_variants: "Anyone can insert/update/delete product variants" (using true).
--   * admin_settings: any signed-in user could insert/update site settings.
--   * abandoned_carts: insert/update policies passable by anonymous visitors.
--   * newsletter_subscriptions: SELECT "using (true)" -> list readable by anyone.
--   * SECURITY DEFINER functions callable by anon: update_product_stock, reduce_product_stock,
--     reserve_stock_for_checkout, release_stock_for_cancellation, cleanup jobs, get_user_cart, ...
--
-- AFTER THIS SCRIPT:
--   profiles, orders, order_items : signed-in users READ only their own rows; admins read all; no API writes
--   cart_items                    : signed-in users fully manage only their own cart
--   newsletter_subscriptions      : anyone can subscribe; nobody can read the list
--   product_variants              : everyone can read; only the product's owner (or an admin) can change
--   admin_settings                : everyone can read (no secrets stored); writes only via service role
--   abandoned_carts               : service role only
--   stock / cleanup / cart functions: service role only (the app never calls them with other keys)
--
-- The app's server code writes with the service-role key (bypasses RLS), so it keeps working.
-- ORDER: deploy the `modern-style` code FIRST, then run this script (one transaction).
-- ROLLBACK: previous policies + grants are saved in private.* tables (see bottom).
-- =====================================================================================

begin;

-- 0. Backups (in a schema the public API cannot reach)
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private._policy_backup_20261122 as
  select now() as backed_up_at, p.*
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('profiles', 'orders', 'order_items', 'cart_items', 'newsletter_subscriptions',
                        'product_variants', 'admin_settings', 'abandoned_carts');

create table if not exists private._function_grants_backup_20261122 as
  select now() as backed_up_at, p.proname, pg_get_function_identity_arguments(p.oid) as args,
         has_function_privilege('anon', p.oid, 'execute') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'execute') as authed_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef;

-- 1. Helper: is the signed-in user an admin? (profiles.is_admin, NOT user-editable metadata)
--    SECURITY DEFINER so policies on profiles can use it without recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2. Drop ALL existing policies on the customer tables and product_variants
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'orders', 'order_items', 'cart_items', 'newsletter_subscriptions', 'product_variants')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2b. Drop only the unsafe WRITE policies on admin_settings / abandoned_carts (reads stay as they are)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('admin_settings', 'abandoned_carts')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3. RLS on (already on for all tables, kept for safety)
alter table public.profiles                 enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;
alter table public.cart_items               enable row level security;
alter table public.newsletter_subscriptions enable row level security;
alter table public.product_variants         enable row level security;
alter table public.admin_settings           enable row level security;
alter table public.abandoned_carts          enable row level security;

-- 4. profiles: own row + admins, read only
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: admins read all" on public.profiles
  for select to authenticated using (public.is_admin());

-- 5. orders: own + admins, read only
create policy "orders: read own" on public.orders
  for select to authenticated using (user_id = auth.uid());
create policy "orders: admins read all" on public.orders
  for select to authenticated using (public.is_admin());

-- 6. order_items: items of own orders + admins, read only
create policy "order_items: read own" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
create policy "order_items: admins read all" on public.order_items
  for select to authenticated using (public.is_admin());

-- 7. cart_items: own cart only (all operations)
create policy "cart_items: manage own" on public.cart_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 8. newsletter: subscribe only
create policy "newsletter: anyone can subscribe" on public.newsletter_subscriptions
  for insert to anon, authenticated
  with check (status = 'active' and unsubscribed_at is null);

-- 9. product_variants: public read; changes only by the product's owner (supplier) or an admin
create policy "product_variants: anyone can read" on public.product_variants
  for select to anon, authenticated using (true);
create policy "product_variants: owner or admin can insert" on public.product_variants
  for insert to authenticated
  with check (public.is_admin() or exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));
create policy "product_variants: owner or admin can update" on public.product_variants
  for update to authenticated
  using (public.is_admin() or exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())))
  with check (public.is_admin() or exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));
create policy "product_variants: owner or admin can delete" on public.product_variants
  for delete to authenticated
  using (public.is_admin() or exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));

-- (admin_settings keeps its public SELECT policy — it stores no secrets; writes are service-role only.)
-- (abandoned_carts: no API write policies — only server jobs write it, with the service role.)

-- 10. Dangerous SECURITY DEFINER functions: service role only. None are called by the app with other keys.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('update_product_stock', 'reduce_product_stock', 'reserve_stock_for_checkout',
                        'release_stock_for_cancellation', 'cleanup_failed_orders', 'manual_cleanup_failed_orders',
                        'schedule_daily_cleanup', 'get_user_cart', 'check_order_has_supplier_products',
                        'check_product_ownership')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

commit;

-- =====================================================================================
-- ROLLBACK (only if something breaks — it re-opens the holes!)
--   1. Re-create the old policies — this OUTPUTS the SQL to run:
--      select format('create policy %I on %I.%I as %s for %s to %s%s%s;',
--        policyname, schemaname, tablename, permissive, cmd, array_to_string(roles, ', '),
--        case when qual is not null then ' using (' || qual || ')' else '' end,
--        case when with_check is not null then ' with check (' || with_check || ')' else '' end) as restore_sql
--      from private._policy_backup_20261122;
--      (first drop the new policies whose names start with "profiles:", "orders:", "order_items:",
--       "cart_items:", "newsletter:", "product_variants:")
--   2. Function grants: see private._function_grants_backup_20261122 and re-grant execute where needed.
-- =====================================================================================
