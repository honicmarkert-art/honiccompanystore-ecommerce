-- =====================================================================================
-- Security review queries — READ ONLY (safe to run any time in Supabase -> SQL Editor)
-- Run after 2026-11-22-rls-lockdown.sql. Each query is independent; run them one at a time.
-- =====================================================================================

-- 1. Tables in the public schema WITHOUT row level security.
--    Any table listed here is fully readable/writable through the public API (unless grants were revoked).
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2. Every policy, so overly open ones stand out.
--    Look for: roles containing {anon} or {public} on non-catalog tables, and qual = 'true'.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. Policies that allow EVERYONE (qual = true) to write — these are almost always mistakes.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (qual = 'true' or with_check = 'true')
order by 1, 2;

-- 4. SECURITY DEFINER functions that anonymous visitors can call.
--    These run with the owner's rights and ignore RLS, e.g. update_product_stock, reduce_product_stock,
--    check_and_decrement_stock. Stock-changing functions should NOT be executable by anon.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as signed_in_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by anon_can_execute desc, 1;

-- 5. Storage buckets and whether they are public (ID cards / certificates must NOT be in a public bucket).
select id as bucket, public
from storage.buckets
order by public desc, id;
