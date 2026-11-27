-- Buy from China: shipping by air or sea, each with its own price.
--   Air: priced per chargeable kg = the larger of the actual weight and the volume weight
--        (L x W x H cm / divisor, 6000 = the usual air-cargo figure), with a minimum and rounding step.
--   Sea: priced per CBM (L x W x H cm / 1,000,000), with a minimum.
--   Both use weight breaks: the whole shipment pays the rate of the break its size falls into.
-- Prices are in US dollars and charged in TSh at the exchange rate set here (rounded up to 100).

-- 1) packed size and weight of one unit (any product; China items need them for shipping prices)
alter table public.products
  add column if not exists weight_kg numeric(10,3) check (weight_kg is null or weight_kg > 0),
  add column if not exists length_cm numeric(10,1) check (length_cm is null or length_cm > 0),
  add column if not exists width_cm numeric(10,1) check (width_cm is null or width_cm > 0),
  add column if not exists height_cm numeric(10,1) check (height_cm is null or height_cm > 0);

-- 2) rates (one row). Public to read (they are shown to shoppers); changed only by the admin app.
create table if not exists public.import_freight_settings (
  id smallint primary key default 1 check (id = 1),
  usd_tzs numeric(10,2) not null check (usd_tzs > 0),
  air jsonb not null,
  sea jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.import_freight_settings enable row level security;
drop policy if exists import_freight_settings_read on public.import_freight_settings;
create policy import_freight_settings_read on public.import_freight_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.import_freight_settings from anon, authenticated;

insert into public.import_freight_settings (id, usd_tzs, air, sea) values (1, 2600,
  '{"tiers":[{"from":0,"usd":15},{"from":10,"usd":13},{"from":50,"usd":12}],"divisor":6000,"minKg":1,"stepKg":0.5,"daysMin":7,"daysMax":14}',
  '{"tiers":[{"from":0,"usd":450},{"from":1,"usd":400}],"minCbm":0.05,"daysMin":45,"daysMax":60}')
on conflict (id) do nothing;

-- 3) orders: how the China items travel and what their shipping costs
--   included       shipping was priced and is in total_amount
--   pending_quote  some items had no size/weight: priced after weighing, paid on arrival
--   quoted         the price was set (import_freight_quote_tzs), waiting for payment
--   paid           the quoted shipping was paid (reference kept)
alter table public.orders
  add column if not exists import_freight_mode text check (import_freight_mode in ('air', 'sea')),
  add column if not exists import_freight_tzs numeric(14,2) not null default 0 check (import_freight_tzs >= 0),
  add column if not exists import_freight_status text check (import_freight_status in ('included', 'pending_quote', 'quoted', 'paid')),
  add column if not exists import_freight_quote_tzs numeric(14,2) check (import_freight_quote_tzs is null or import_freight_quote_tzs >= 0),
  add column if not exists import_freight_details jsonb,
  add column if not exists import_freight_reference text,
  add column if not exists import_freight_updated_at timestamptz;

-- 4) shoppers may not set or change freight (or refund) columns on their own orders
create or replace function private.guard_order_payment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  -- changes made by other triggers (e.g. add_payment_status_to_profile) are system changes, not user edits
  if pg_trigger_depth() > 1 then return new; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.payment_status, 'pending') <> 'pending' or coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'New orders must start as pending' using errcode = '42501';
    end if;
    if new.import_freight_status is not null or coalesce(new.import_freight_tzs, 0) <> 0 or new.import_freight_quote_tzs is not null
       or new.refund_status is not null or new.refund_amount is not null then
      raise exception 'Not allowed to set shipping or refund fields' using errcode = '42501';
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
     or new.id is distinct from old.id
     or new.import_freight_mode is distinct from old.import_freight_mode
     or new.import_freight_tzs is distinct from old.import_freight_tzs
     or new.import_freight_status is distinct from old.import_freight_status
     or new.import_freight_quote_tzs is distinct from old.import_freight_quote_tzs
     or new.import_freight_details is distinct from old.import_freight_details
     or new.import_freight_reference is distinct from old.import_freight_reference
     or new.refund_status is distinct from old.refund_status
     or new.refund_amount is distinct from old.refund_amount
     or new.refund_reference is distinct from old.refund_reference
     or new.refunded_at is distinct from old.refunded_at then
    raise exception 'Not allowed to change order status, payment or totals' using errcode = '42501';
  end if;
  return new;
end $$;
