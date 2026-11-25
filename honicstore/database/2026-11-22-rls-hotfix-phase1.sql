-- =====================================================================================
-- PHASE 1 HOTFIX — 2026-11-22 — safe to run BEFORE the new app code is deployed.
--
-- Closes every hole that lets ANONYMOUS visitors read or change data, and stops signed-in users
-- from escalating privileges or faking payments — while keeping the "own row" policies the
-- currently-live code still relies on (wishlist / profile edit / cart / own orders).
--
-- Phase 2 (2026-11-22-rls-lockdown.sql) runs after the deploy and removes the remaining
-- direct-write policies. The triggers below stay as an extra layer of defence.
-- Visible side effect until the deploy: the supplier card on product pages may not load (the old
-- code reads supplier profiles with the anon key; the new code uses the service key).
-- =====================================================================================

begin;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- Backups
create table if not exists private._policy_backup_phase1_20261122 as
  select now() as backed_up_at, p.* from pg_policies p where p.schemaname = 'public';
create table if not exists private._function_grants_backup_20261122 as
  select now() as backed_up_at, p.proname, pg_get_function_identity_arguments(p.oid) as args,
         has_function_privilege('anon', p.oid, 'execute') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'execute') as authed_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef;

-- Admin check based on profiles.is_admin (NOT user-editable auth metadata)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 1. Drop every policy that anonymous visitors can pass:
--    "auth.uid() IS NULL" conditions, the "... OR true" profiles policy, open writes, open newsletter read.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and (
         coalesce(qual, '') ~* 'auth\.uid\(\)\s+is\s+null'
      or coalesce(with_check, '') ~* 'auth\.uid\(\)\s+is\s+null'
      or coalesce(qual, '') ~* 'or\s+true\s*\)?\s*$'
      or (cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
          and tablename <> 'newsletter_subscriptions')
      or (tablename = 'newsletter_subscriptions' and cmd = 'SELECT' and qual = 'true')
      or (tablename = 'admin_settings' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
      or (tablename = 'orders' and policyname = 'orders_insert_creation_only')
    )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 1b. This UPDATE policy trusted user-editable auth metadata (role=admin) and, because it reads auth.users,
--     made every customer profile update fail with "permission denied for table users".
drop policy if exists "profiles_update_is_active_admin" on public.profiles;

-- 2. Re-add what legitimate users need that was bundled into the dropped policies
create policy "orders: admins read all" on public.orders
  for select to authenticated using (public.is_admin());
create policy "order_items: admins read all" on public.order_items
  for select to authenticated using (public.is_admin());

-- product_variants: public read; changes only by the product's owner (supplier) or an admin
drop policy if exists "product_variants: anyone can read" on public.product_variants;
create policy "product_variants: anyone can read" on public.product_variants
  for select to anon, authenticated using (true);
create policy "product_variants: owner or admin can insert" on public.product_variants
  for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));
create policy "product_variants: owner or admin can update" on public.product_variants
  for update to authenticated
  using (public.is_admin() or exists (select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())))
  with check (public.is_admin() or exists (select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));
create policy "product_variants: owner or admin can delete" on public.product_variants
  for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.products p
    where p.id = product_variants.product_id and (p.supplier_id = auth.uid() or p.user_id = auth.uid())));

-- 3. Guard: users can't change privileged profile fields (blocks "make myself admin")
create or replace function private.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- server code (service_role) and direct DB sessions are trusted
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  -- changes made by other triggers (e.g. add_payment_status_to_profile) are system changes, not user edits
  if pg_trigger_depth() > 1 then return new; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) or coalesce(new.is_verified, false) or new.supplier_plan_id is not null
       or new.payment_status is not null then
      raise exception 'Not allowed to set privileged profile fields' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     or new.is_supplier is distinct from old.is_supplier
     or new.is_verified is distinct from old.is_verified
     or new.is_active is distinct from old.is_active
     or new.supplier_plan_id is distinct from old.supplier_plan_id
     or new.pending_plan_id is distinct from old.pending_plan_id
     or new.pending_premium_plan_id is distinct from old.pending_premium_plan_id
     or new.payment_reference_id is distinct from old.payment_reference_id
     or new.payment_amount is distinct from old.payment_amount
     or new.payment_currency is distinct from old.payment_currency
     or new.payment_status is distinct from old.payment_status
     or new.payment_method is distinct from old.payment_method
     or new.payment_statuses is distinct from old.payment_statuses
     or new.payment_timestamp is distinct from old.payment_timestamp
     or new.payment_expires_at is distinct from old.payment_expires_at
     or new.clickpesa_transaction_id is distinct from old.clickpesa_transaction_id
     or new.supplier_rating is distinct from old.supplier_rating
     or new.supplier_review_count is distinct from old.supplier_review_count
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id
     or new.supplier_id is distinct from old.supplier_id
     or new.id is distinct from old.id then
    raise exception 'Not allowed to change privileged profile fields' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function private.guard_profile_privileged_columns();

-- 4. Guard: users can't fake payments/statuses/totals on orders
create or replace function private.guard_order_payment_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  -- changes made by other triggers (e.g. add_payment_status_to_profile) are system changes, not user edits
  if pg_trigger_depth() > 1 then return new; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.payment_status, 'pending') <> 'pending' or coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'New orders must start as pending' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status
     or new.payment_method is distinct from old.payment_method
     or new.payment_id is distinct from old.payment_id
     or new.payment_timestamp is distinct from old.payment_timestamp
     or new.total_amount is distinct from old.total_amount
     or new.currency is distinct from old.currency
     or new.clickpesa_transaction_id is distinct from old.clickpesa_transaction_id
     or new.confirmation_status is distinct from old.confirmation_status
     or new.tracking_number is distinct from old.tracking_number
     or new.reference_id is distinct from old.reference_id
     or new.order_number is distinct from old.order_number
     or new.user_id is distinct from old.user_id
     or new.id is distinct from old.id then
    raise exception 'Not allowed to change order status, payment or totals' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_order_payment_columns on public.orders;
create trigger guard_order_payment_columns
  before insert or update on public.orders
  for each row execute function private.guard_order_payment_columns();

-- 5. Dangerous SECURITY DEFINER functions: service role only (none are called by the app with other keys)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
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

-- ROLLBACK: old policies are in private._policy_backup_phase1_20261122 (generate create statements as in
-- the phase 2 file); drop the two triggers; re-grant functions per private._function_grants_backup_20261122.
