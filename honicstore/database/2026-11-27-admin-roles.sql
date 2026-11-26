-- Admin roles for the admin app. Server only (RLS on, no policies): read and written by the admin app
-- with the service role, never from a browser.
--   owner: everything
--   staff: day-to-day work (orders, products, customers, documents); no money out, no security
-- An admin (profiles.is_admin) without a row here is treated as staff (least access).

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
revoke all on public.admin_roles from anon, authenticated;

-- everyone who is an admin today is an owner (today: the one owner account)
insert into public.admin_roles (user_id, role)
select id, 'owner' from public.profiles where is_admin = true
on conflict (user_id) do nothing;

-- Direct database access (RLS) with a user's own login: only owners count as admin. The admin app
-- works through the server key and checks roles itself, so staff never get database-wide powers.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admin_roles r where r.user_id = auth.uid() and r.role = 'owner')
$$;
