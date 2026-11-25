-- =====================================================================================
-- Advertisements: "Admins can manage advertisements" only checked that the caller was signed in
-- ((auth.jwt() ->> 'role') = 'authenticated'), so ANY shopper could create, edit or delete ads
-- using the public key. Replace it with a real admin check. Supplier rules (own, inactive ads)
-- and public read are unchanged; server code using the service-role key bypasses RLS.
-- Rollback: recreate the old policy with the qual shown above (not recommended).
-- =====================================================================================
begin;

drop policy if exists "Admins can manage advertisements" on public.advertisements;

create policy "Admins can manage advertisements" on public.advertisements
  as permissive for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
