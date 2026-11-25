-- =====================================================================================
-- Cleanup — 2026-11-22 (APPLIED)
-- Unused leftovers moved out of the public API into the private schema (not deleted).
--   orders_backup, order_items_backup, profiles_backup : old copies, unused (profiles_backup holds personal data)
--   products_listing_view : stale materialized view (20 of 270 products), unused, no trigger attached
--
-- Restore any of them with:  alter table private.<name> set schema public;
--                            alter materialized view private.products_listing_view set schema public;
-- Delete permanently later (once you're sure) with: drop table private.<name>;
-- =====================================================================================
begin;
alter table if exists public.orders_backup set schema private;
alter table if exists public.order_items_backup set schema private;
alter table if exists public.profiles_backup set schema private;
alter materialized view if exists public.products_listing_view set schema private;
commit;
