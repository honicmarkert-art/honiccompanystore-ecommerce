-- Reset product ratings / review counts / sold counts and seller ratings to the REAL values.
-- The catalogue was seeded with made-up numbers (19,040 reviews and 15,343 "sold" vs 0 real reviews
-- and 14 orders). Same rules as the existing triggers, so they stay correct from here on:
--   rating/reviews  -> update_product_review_stats (from product_reviews)
--   sold/buyers     -> update_product_sold_stats_on_order_change (paid + confirmed/processing/shipped/delivered/completed)
-- Backups of the old numbers: database/backups/2026-11-25-*-stats-before-reset.json
-- Safe to run again (always recalculates).

begin;

update public.products p
set rating = coalesce(r.avg_rating, 0),
    reviews = coalesce(r.n, 0)
from (
  select pr.id,
         (select avg(rating)::numeric(3,2) from public.product_reviews x where x.product_id = pr.id) as avg_rating,
         (select count(*) from public.product_reviews x where x.product_id = pr.id) as n
  from public.products pr
) r
where p.id = r.id;

update public.products p
set sold_count = coalesce(s.sold, 0),
    buyers_count = coalesce(s.buyers, 0)
from (
  select pr.id,
         (select sum(oi.quantity) from public.order_items oi join public.orders o on o.id = oi.order_id
           where oi.product_id = pr.id
             and o.payment_status in ('paid', 'completed', 'success')
             and o.status in ('confirmed', 'processing', 'shipped', 'delivered', 'completed')) as sold,
         (select count(distinct o.user_id) from public.order_items oi join public.orders o on o.id = oi.order_id
           where oi.product_id = pr.id and o.user_id is not null
             and o.payment_status in ('paid', 'completed', 'success')
             and o.status in ('confirmed', 'processing', 'shipped', 'delivered', 'completed')) as buyers
  from public.products pr
) s
where p.id = s.id;

-- Sellers: there are no seller reviews yet
update public.profiles set supplier_rating = null, supplier_review_count = 0
where is_supplier;

commit;

select
  (select count(*) from public.products where reviews > 0) as products_with_reviews,
  (select coalesce(sum(reviews), 0) from public.products) as total_reviews,
  (select count(*) from public.products where sold_count > 0) as products_with_sales,
  (select coalesce(sum(sold_count), 0) from public.products) as total_sold,
  (select coalesce(sum(supplier_review_count), 0) from public.profiles where is_supplier) as seller_reviews;
