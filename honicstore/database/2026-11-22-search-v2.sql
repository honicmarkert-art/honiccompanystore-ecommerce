-- =====================================================================================
-- Product search v2 — 2026-11-22
-- One fast, typo-tolerant, ranked search used by the Marketplace page (typed search + AI search).
-- Uses what the database already has: pg_trgm + unaccent extensions, trigram indexes on
-- name/brand/category/description, and products.search_vector (kept up to date by a trigger, 'simple' config).
--
-- Matching (a product matches if ANY is true):
--   * every query word is the start of a word in the product's search_vector  ("ardu" -> Arduino)
--   * every query word appears in name/brand/category or is a close typo of a name word ("arduno", "raspbery pi")
--   * the query with spaces/dashes removed appears in name/model/sku           ("loadcell", "hcsr04", "esp 32")
-- Ranking: full-text rank + name similarity + compact match + starts-with + brand/category similarity,
--          small boosts for in-stock and popular items.
-- Security: SECURITY INVOKER (respects RLS); hidden products are always excluded.
-- =====================================================================================

create extension if not exists fuzzystrmatch with schema extensions;   -- levenshtein() for typo tolerance

-- return type changed (added is_strong) -> drop the old version first
drop function if exists public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer);

create or replace function public.search_products_v2(
  q text default '',
  category_ids uuid[] default null,
  min_price numeric default null,
  max_price numeric default null,
  in_stock_only boolean default false,
  sort_by text default 'relevance',      -- relevance | price_asc | price_desc | newest | rating | popular
  lim integer default 24,
  off integer default 0
)
returns table (id bigint, score real, total_count bigint, is_strong boolean)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  qn text := lower(unaccent(coalesce(q, '')));
  qc text;
  tsq tsquery;
  toks text[];
begin
  qn := trim(regexp_replace(regexp_replace(qn, '[^a-z0-9\s\-\.]', ' ', 'g'), '\s+', ' ', 'g'));
  qn := left(qn, 100);
  qc := regexp_replace(qn, '[^a-z0-9]', '', 'g');
  toks := array(select t from unnest(regexp_split_to_array(qn, '[\s\-\.]+')) t where t <> '');

  if qn <> '' then
    select to_tsquery('simple', string_agg(quote_literal(t) || ':*', ' & '))
      into tsq
      from unnest(regexp_split_to_array(qn, '[\s\-\.]+')) as t
     where t <> '';
  end if;

  return query
  with base as (
    select p.id, p.price, p.created_at, p.rating, p.sold_count, p.in_stock, p.search_vector,
           lower(unaccent(coalesce(p.name, ''))) as ln,
           regexp_replace(lower(unaccent(coalesce(p.name, '') || ' ' || coalesce(p.model, '') || ' ' || coalesce(p.sku, ''))), '[^a-z0-9]', '', 'g') as lc,
           lower(coalesce(p.category, '')) as lcat,
           lower(coalesce(p.brand, '')) as lbrand,
           -- description only (NOT specs: almost every product has a "Weight: 10g" spec, which made
           -- words like "weight" match everything)
           to_tsvector('simple', lower(unaccent(coalesce(p.description, '')))) as dvec
      from public.products p
     where coalesce(p.is_hidden, false) = false
       and (category_ids is null or p.category_id = any(category_ids))
       and (min_price is null or p.price >= min_price)
       and (max_price is null or p.price <= max_price)
       and (not in_stock_only or coalesce(p.in_stock, false))
  ),
  scored as (
    select b.*,
           case when qn = '' then 0::float8 else
               coalesce(ts_rank_cd(b.search_vector, tsq), 0) * 3
             + word_similarity(qn, b.ln) * 2
             + case when length(qc) >= 3 and position(qc in b.lc) > 0 then 1.5 else 0 end
             + case when b.ln like qn || '%' then 1 else 0 end
             + similarity(qn, b.lcat) * 0.5
             + similarity(qn, b.lbrand) * 0.5
           end as s,
           -- strong = match in name/brand (not category alone), compact model/sku match, or close name typo
           (qn = ''
             or (tsq is not null and to_tsvector('simple', b.ln || ' ' || b.lbrand) @@ tsq)
             or (cardinality(toks) > 0 and not exists (
                select 1 from unnest(toks) t
                 where position(t in b.ln || ' ' || b.lbrand) = 0
                   and not exists (       -- typo tolerance like big search engines: 1 edit for 5-7 letters, 2 for 8+
                         select 1 from regexp_split_to_table(b.ln, '[^a-z0-9]+') w
                          where length(w) >= 3 and (
                                (length(t) between 5 and 7 and levenshtein(t, w) <= 1)
                             or (length(t) >= 8 and levenshtein(t, w) <= 2)
                             or (length(t) >= 5 and similarity(t, w) >= 0.6)))))   -- every word present or a close typo
             or (length(qc) >= 3 and position(qc in b.lc) > 0)) as strong
      from base b
     where qn = ''
        or (tsq is not null and b.dvec @@ tsq)                   -- weak: description only
        or (cardinality(toks) > 0 and not exists (
                select 1 from unnest(toks) t
                 where position(t in b.ln || ' ' || b.lbrand || ' ' || b.lcat) = 0
                   and not exists (       -- typo tolerance like big search engines: 1 edit for 5-7 letters, 2 for 8+
                         select 1 from regexp_split_to_table(b.ln, '[^a-z0-9]+') w
                          where length(w) >= 3 and (
                                (length(t) between 5 and 7 and levenshtein(t, w) <= 1)
                             or (length(t) >= 8 and levenshtein(t, w) <= 2)
                             or (length(t) >= 5 and similarity(t, w) >= 0.6)))))
        or (length(qc) >= 3 and position(qc in b.lc) > 0)
  ),
  filtered as (
    -- description-only matches are added only when there are few strong matches
    select sc.* from scored sc
     where sc.strong or (select count(*) from scored x where x.strong) < 6
  )
  select sc.id,
         (sc.s + case when sc.in_stock then 0.05 else 0 end + ln(1 + greatest(coalesce(sc.sold_count, 0), 0)) * 0.02)::real,
         count(*) over (),
         sc.strong
    from filtered sc
   order by
     sc.strong desc,   -- strong (name/brand) matches always before category/description-only ones
     case when sort_by = 'price_asc'  then sc.price end asc nulls last,
     case when sort_by = 'price_desc' then sc.price end desc nulls last,
     case when sort_by = 'newest'     then sc.created_at end desc nulls last,
     case when sort_by = 'rating'     then sc.rating end desc nulls last,
     case when sort_by = 'popular'    then sc.sold_count end desc nulls last,
     sc.s desc,
     sc.sold_count desc nulls last,
     sc.id desc
   limit greatest(1, least(coalesce(lim, 24), 100))
  offset greatest(coalesce(off, 0), 0);
end
$$;

revoke all on function public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) from public;
grant execute on function public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) to anon, authenticated, service_role;
