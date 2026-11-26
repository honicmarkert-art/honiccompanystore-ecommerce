-- Seller payouts: remember who sold each item and the plan commission rate at the moment the order was
-- confirmed, so changing a plan later never changes what Honic owes for past sales.

alter table public.confirmed_order_items
  add column if not exists seller_id uuid,
  add column if not exists commission_rate numeric(5,2);

create or replace function private.snapshot_item_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.seller_id is null then
    select p.supplier_id into new.seller_id from public.products p where p.id = new.product_id;
  end if;
  if new.commission_rate is null and new.seller_id is not null then
    select sp.commission_rate into new.commission_rate
    from public.profiles pr join public.supplier_plans sp on sp.id = pr.supplier_plan_id
    where pr.id = new.seller_id;
  end if;
  return new;
end
$$;

drop trigger if exists snapshot_item_commission on public.confirmed_order_items;
create trigger snapshot_item_commission
  before insert on public.confirmed_order_items
  for each row execute function private.snapshot_item_commission();

-- existing items: use today's owner and rate (the best record available)
update public.confirmed_order_items i
set seller_id = p.supplier_id
from public.products p
where p.id = i.product_id and i.seller_id is null;

update public.confirmed_order_items i
set commission_rate = sp.commission_rate
from public.profiles pr join public.supplier_plans sp on sp.id = pr.supplier_plan_id
where pr.id = i.seller_id and i.commission_rate is null;

-- sellers may still change only status / tracking: the two new columns are protected too
create or replace function private.guard_confirmed_order_item_columns()
returns trigger
language plpgsql
security definer
set search_path = public
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
     or new.total_price is distinct from old.total_price
     or new.seller_id is distinct from old.seller_id
     or new.commission_rate is distinct from old.commission_rate then
    raise exception 'Only item status / tracking can be changed' using errcode = '42501';
  end if;
  return new;
end
$$;
