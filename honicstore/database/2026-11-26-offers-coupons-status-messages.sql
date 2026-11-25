-- =====================================================================================
-- 2026-11-26: price offers, coupon usage, order status messages
--
-- 1. price_offers: "Make an offer" requests from product pages (server access only).
-- 2. orders.promotion_code + use_promotion(): coupons record which order used them and the
--    use is counted when the order is PAID (before this, used_count was never increased, so
--    usage limits did not work).
-- 3. order_notifications: one row per (order, step, channel) so a status message goes once.
-- 4. Status messages: when a seller or admin marks an order shipped / ready for pickup /
--    delivered, the database calls the store (/api/webhooks/order-status) via pg_net.
--    URL and secret live in Supabase Vault (set separately, never in this file).
-- Additive only. Status changes are never blocked if the call fails.
-- =====================================================================================
begin;

-- 1. offers ---------------------------------------------------------------------------
create table if not exists public.price_offers (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  product_id integer not null,
  product_name text,
  supplier_id uuid,
  list_price numeric not null,
  offer_price numeric not null check (offer_price > 0),
  quantity integer not null default 1 check (quantity between 1 and 10000),
  name text,
  phone text not null,
  email text,
  region text,
  note text,
  user_id uuid,
  status text not null default 'new' check (status in ('new', 'accepted', 'countered', 'declined')),
  agreed_price numeric,
  coupon_code text,
  decided_at timestamptz,
  decided_by uuid,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists price_offers_status_created on public.price_offers (status, created_at desc);
alter table public.price_offers enable row level security;   -- no policies: server (service role) only
revoke all on public.price_offers from anon, authenticated;

-- 2. coupon usage ----------------------------------------------------------------------
alter table public.orders add column if not exists promotion_code text;

-- product_ids held UUIDs, but product ids are numbers, so "only for these products" coupons could
-- never be saved (the code already compares them as text). No existing coupon uses it.
alter table public.supplier_promotions alter column product_ids drop default;
alter table public.supplier_promotions alter column product_ids type text[] using product_ids::text[];
alter table public.supplier_promotions alter column product_ids set default '{}'::text[];

create or replace function public.use_promotion(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.supplier_promotions
     set used_count = coalesce(used_count, 0) + 1, updated_at = now()
   where code = upper(p_code)
     and (usage_limit is null or coalesce(used_count, 0) < usage_limit);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.use_promotion(text) from public, anon, authenticated;

-- 3. status message ledger --------------------------------------------------------------
create table if not exists public.order_notifications (
  id bigserial primary key,
  order_number text not null,
  kind text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  unique (order_number, kind, channel)
);
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from anon, authenticated;

-- 4. status trigger -> store webhook -----------------------------------------------------
create extension if not exists pg_net;
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.notify_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('shipped', 'ready_for_pickup', 'delivered') then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'order_webhook_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'order_webhook_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', new.id, 'status', new.status),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
  return new;
exception when others then
  return new; -- a message problem must never stop the status change
end $$;

drop trigger if exists notify_status_change on public.confirmed_order_items;
create trigger notify_status_change after update of status on public.confirmed_order_items
  for each row execute function private.notify_order_status();
drop trigger if exists notify_status_change on public.confirmed_orders;
create trigger notify_status_change after update of status on public.confirmed_orders
  for each row execute function private.notify_order_status();

commit;
