-- =====================================================================================
-- PHASE 1b — 2026-11-22 — confirmed_orders / confirmed_order_items
--
-- Found: policies "Authenticated users can manage confirmed orders / items" (FOR ALL, auth.role() =
-- 'authenticated') let ANY signed-in customer read, change and delete EVERY confirmed (paid) order.
--
-- After: customers see/update only their own confirmed orders; suppliers see/update only orders and
-- items containing their products; admins read all. Inserts/deletes only via the service role
-- (admin app). Guards limit which columns customers/suppliers may change.
-- Compatible with both the live and the new app code (both use these scoped, session-based reads).
-- =====================================================================================

begin;

create schema if not exists private;
create table if not exists private._policy_backup_phase1b_20261122 as
  select now() as backed_up_at, p.* from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('confirmed_orders', 'confirmed_order_items');

-- Helpers (SECURITY DEFINER: they read the other table without triggering its RLS -> no policy recursion)
create or replace function public.owns_confirmed_order(order_uuid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.confirmed_orders o where o.id = order_uuid and o.user_id = auth.uid()) $$;

create or replace function public.supplies_confirmed_order(order_uuid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.confirmed_order_items i
    join public.products p on p.id = i.product_id
    where i.confirmed_order_id = order_uuid and (p.supplier_id = auth.uid() or p.user_id = auth.uid()))
$$;

create or replace function public.supplies_product(product bigint)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.products p where p.id = product and (p.supplier_id = auth.uid() or p.user_id = auth.uid())) $$;

revoke all on function public.owns_confirmed_order(uuid) from public, anon;
revoke all on function public.supplies_confirmed_order(uuid) from public, anon;
revoke all on function public.supplies_product(bigint) from public, anon;
grant execute on function public.owns_confirmed_order(uuid) to authenticated;
grant execute on function public.supplies_confirmed_order(uuid) to authenticated;
grant execute on function public.supplies_product(bigint) to authenticated;

-- Replace all policies on both tables
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('confirmed_orders', 'confirmed_order_items')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.confirmed_orders enable row level security;
alter table public.confirmed_order_items enable row level security;

create policy "confirmed_orders: owner, supplier or admin can read" on public.confirmed_orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.supplies_confirmed_order(id));

create policy "confirmed_orders: owner can update (delivery/receipt)" on public.confirmed_orders
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "confirmed_order_items: owner, supplier or admin can read" on public.confirmed_order_items
  for select to authenticated
  using (public.owns_confirmed_order(confirmed_order_id) or public.supplies_product(product_id) or public.is_admin());

create policy "confirmed_order_items: owner or supplier can update status" on public.confirmed_order_items
  for update to authenticated
  using (public.owns_confirmed_order(confirmed_order_id) or public.supplies_product(product_id))
  with check (public.owns_confirmed_order(confirmed_order_id) or public.supplies_product(product_id));

-- Guards: which columns customers/suppliers may change (service role / admin app is unrestricted)
create or replace function private.guard_confirmed_order_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  -- changes made by other triggers (e.g. add_payment_status_to_profile) are system changes, not user edits
  if pg_trigger_depth() > 1 then return new; end if;
  -- allowed: status, is_received, received_at, updated_at
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.order_id is distinct from old.order_id
     or new.original_order_id is distinct from old.original_order_id
     or new.order_number is distinct from old.order_number
     or new.reference_id is distinct from old.reference_id
     or new.total_amount is distinct from old.total_amount
     or new.payment_method is distinct from old.payment_method
     or new.payment_status is distinct from old.payment_status
     or new.shipping_address is distinct from old.shipping_address
     or new.billing_address is distinct from old.billing_address
     or new.delivery_option is distinct from old.delivery_option
     or new.confirmed_by is distinct from old.confirmed_by
     or new.confirmed_at is distinct from old.confirmed_at
     or new.pickup_id is distinct from old.pickup_id then
    raise exception 'Only delivery status fields can be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_confirmed_order_columns on public.confirmed_orders;
create trigger guard_confirmed_order_columns
  before update on public.confirmed_orders
  for each row execute function private.guard_confirmed_order_columns();

create or replace function private.guard_confirmed_order_item_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  -- changes made by other triggers (e.g. add_payment_status_to_profile) are system changes, not user edits
  if pg_trigger_depth() > 1 then return new; end if;
  -- allowed: status, tracking_number
  if new.id is distinct from old.id
     or new.confirmed_order_id is distinct from old.confirmed_order_id
     or new.product_id is distinct from old.product_id
     or new.variant_id is distinct from old.variant_id
     or new.product_name is distinct from old.product_name
     or new.variant_name is distinct from old.variant_name
     or new.quantity is distinct from old.quantity
     or new.price is distinct from old.price
     or new.total_price is distinct from old.total_price then
    raise exception 'Only item status / tracking can be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_confirmed_order_item_columns on public.confirmed_order_items;
create trigger guard_confirmed_order_item_columns
  before update on public.confirmed_order_items
  for each row execute function private.guard_confirmed_order_item_columns();

commit;
