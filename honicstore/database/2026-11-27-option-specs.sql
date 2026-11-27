-- Product options (product_variants): their own specifications and an optional "was" price.
--   specifications: {"Screen size": "55 inch", "Resolution": "4K"}; merged over the product's own
--                   specifications in the shop when the option is chosen (option values win)
--   original_price: shown crossed out next to the option's price; must be higher than the price

alter table public.product_variants
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists original_price numeric(14,2);

do $$ begin
  alter table public.product_variants add constraint product_variants_specs_object check (jsonb_typeof(specifications) = 'object');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.product_variants add constraint product_variants_original_price_higher check (original_price is null or original_price > price);
exception when duplicate_object then null; end $$;
