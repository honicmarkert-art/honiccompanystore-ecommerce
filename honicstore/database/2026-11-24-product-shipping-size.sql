-- Parcel size per product, used for delivery fees (lib/shipping-pricing-config.ts SIZE_SURCHARGE).
--   empty (NULL) or 'small' = standard parcel (most components)
--   'medium' = e.g. 1 kg filament spools          -> +TSh 2,000 outside Dar es Salaam
--   'large'  = e.g. 3D printers, water purifiers  -> +TSh 5,000 in Dar, +TSh 15,000 elsewhere
-- OPTIONAL column: no NOT NULL, no default required. Existing inserts/updates keep working unchanged;
-- an empty value counts as a standard parcel. Safe to run more than once.

alter table public.products
  add column if not exists shipping_size text;

do $$ begin
  alter table public.products
    add constraint products_shipping_size_check
    check (shipping_size is null or shipping_size in ('small', 'medium', 'large'));
exception when duplicate_object then null; end $$;

-- Large: 3D printers and the RO water purifier
update public.products set shipping_size = 'large'
where id in (213, 270, 424);

-- Medium: 1 kg 3D printer filament spools
update public.products set shipping_size = 'medium'
where id in (271, 272, 273, 274, 275, 276);

-- check
select coalesce(shipping_size, '(empty = standard)') as shipping_size, count(*)
from public.products group by 1 order by 1;
