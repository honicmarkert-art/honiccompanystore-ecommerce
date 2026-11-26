-- Admin powers in the database now require a two-step verified session (aal2).
--
-- Why: 24 row-level-security policies trusted any session of a user with profiles.is_admin = true,
-- including a plain shop sign-in with only a password. A stolen admin password was enough to read all
-- orders, invoices and newsletter emails, read AND change sellers' payout accounts, and edit or delete
-- products, variants and ads straight from the browser.
--
-- The new admin dashboard (/admin) works server-side with the service role, so it does not need
-- any of these browser policies. NOTE: the old honicstore-admin project reads some tables from the
-- browser; those parts stop working for it (it has no two-step sign-in).
--
-- Safe to run more than once.

begin;

-- 1) is_admin(): true only for an admin whose CURRENT session passed two-step verification.
--    Every policy that calls is_admin() (orders, order_items, confirmed_*, advertisements,
--    product_variants owner-or-admin) is tightened by this one change.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- 2) Admin-only browser policies that repeat the check inline: drop them (the dashboard does not
--    use them; the shop never did).
drop policy if exists "cart_items_admin_full_access" on public.cart_items;
drop policy if exists "invoices_admin_delete" on public.invoices;
drop policy if exists "invoices_admin_insert" on public.invoices;
drop policy if exists "invoices_admin_select" on public.invoices;
drop policy if exists "invoices_admin_update" on public.invoices;
drop policy if exists "Admins can view all newsletter subscriptions" on public.newsletter_subscriptions;
drop policy if exists "Admins can view all order status history" on public.order_status_history;
drop policy if exists "product_variants_delete_admin_only" on public.product_variants;
drop policy if exists "product_variants_insert_admin_only" on public.product_variants;
drop policy if exists "product_variants_update_admin_only" on public.product_variants;
drop policy if exists "products_delete_admin_only" on public.products;
drop policy if exists "products_insert_admin_only" on public.products;
drop policy if exists "products_update_admin_only" on public.products;
drop policy if exists "Admins can view all payout accounts" on public.supplier_payout_accounts;
drop policy if exists "Admins can update all payout accounts" on public.supplier_payout_accounts;

-- 3) Sellers editing their own products: keep it, but the admin part now goes through is_admin().
drop policy if exists "products_update_supplier_own" on public.products;
create policy "products_update_supplier_own" on public.products
  for update
  using (
    auth.uid() is not null and (
      public.is_admin()
      or (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_supplier = true)
          and (supplier_id = auth.uid() or user_id = auth.uid()))
    )
  )
  with check (
    auth.uid() is not null and (
      public.is_admin()
      or (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_supplier = true)
          and (supplier_id = auth.uid() or user_id = auth.uid()))
    )
  );

-- 4) An order can be confirmed only once (blocks duplicates from double clicks / two admins).
--    Old rows without an order_id are allowed (NULLs never clash).
create unique index if not exists confirmed_orders_order_id_unique on public.confirmed_orders (order_id);

commit;
