-- Honic Projects: real projects (stage, dates, category) with their documents and an itemised cost
-- ledger. Server only (RLS on, no policies). Old data stays: project_usage is kept as a backup.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (length(trim(client_name)) > 0),
  title text,
  category text check (category in ('fyp', 'side', 'research')),
  stage text not null default 'quoted' check (stage in ('quoted', 'in_progress', 'testing', 'delivered', 'closed', 'cancelled')),
  client_phone text,
  client_email text,
  institution text,
  start_date date,
  due_date date,
  delivered_on date,
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (lower(trim(client_name)));
create index if not exists projects_stage_idx on public.projects (stage, due_date);
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;

alter table public.invoices add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists invoices_project_idx on public.invoices (project_id) where project_id is not null;

create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('component', 'prototype', 'service', 'other')),
  amount numeric(14,2) not null check (amount > 0),
  spent_on date not null default current_date,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists project_costs_project_idx on public.project_costs (project_id, spent_on);
alter table public.project_costs enable row level security;
revoke all on public.project_costs from anon, authenticated;

-- 1) one project per client from the existing project documents (each client has one invoice today)
with docs as (
  select i.*, lower(trim(i.client_name)) as ckey,
    coalesce((select sum(p.amount) from public.document_payments p where p.invoice_id = i.id), 0) as paid
  from public.invoices i
  where i.dashboard_scope = 'project' and not i.is_usage_record and coalesce(trim(i.client_name), '') <> ''
),
per_client as (
  select ckey,
    (array_agg(trim(client_name) order by created_at desc))[1] as client_name,
    (array_agg(nullif(payload->>'projectCategory', '') order by created_at desc) filter (where nullif(payload->>'projectCategory', '') is not null))[1] as category,
    (array_agg(nullif(payload->>'clientPhone', '') order by created_at desc) filter (where nullif(payload->>'clientPhone', '') is not null))[1] as phone,
    (array_agg(nullif(payload->>'clientEmail', '') order by created_at desc) filter (where nullif(payload->>'clientEmail', '') is not null))[1] as email,
    min(coalesce(issue_date, created_at::date)) as start_date,
    max(due_date) filter (where document_kind = 'invoice') as due_date,
    bool_and(is_hidden or is_void) as all_hidden,
    bool_or(document_kind = 'delivery_note' and not is_void) as delivered,
    max(case when document_kind = 'delivery_note' and not is_void then coalesce(issue_date, created_at::date) end) as delivered_on,
    sum(paid) as paid,
    min(created_at) as first_at
  from docs group by ckey
)
insert into public.projects (client_name, category, stage, client_phone, client_email, start_date, due_date, delivered_on, notes, created_at)
select c.client_name, c.category,
  case when c.all_hidden then 'closed' when c.delivered then 'delivered' when c.paid > 0 then 'in_progress' else 'quoted' end,
  c.phone, c.email, c.start_date, c.due_date, c.delivered_on,
  'Created from the existing invoices on 2026-11-27. Check the stage.', c.first_at
from per_client c
where not exists (select 1 from public.projects p where lower(trim(p.client_name)) = c.ckey);

update public.invoices i set project_id = p.id
from public.projects p
where i.project_id is null and i.dashboard_scope = 'project' and not i.is_usage_record
  and lower(trim(p.client_name)) = lower(trim(i.client_name));

-- 2) usage totals become cost lines (one per section); clients with usage but no project get one
insert into public.projects (client_name, stage, notes)
select trim(u.client_name), 'in_progress', 'Created from usage tracking on 2026-11-27 (no invoice found under this name).'
from public.project_usage u
where not exists (select 1 from public.projects p where lower(trim(p.client_name)) = lower(trim(u.client_name)));

insert into public.project_costs (project_id, kind, amount, spent_on, note, created_at)
select p.id, x.kind, x.amount, u.updated_at::date,
  coalesce(nullif(trim(x.note), ''), 'Total spent before costs were itemised (from usage tracking)'), u.updated_at
from public.project_usage u
join lateral (select id from public.projects p where lower(trim(p.client_name)) = lower(trim(u.client_name)) order by created_at limit 1) p on true
cross join lateral (values ('component', u.component_usage, u.component_note), ('prototype', u.prototype_usage, u.prototype_note), ('service', u.service_used, u.service_note)) as x(kind, amount, note)
where x.amount > 0
  and not exists (select 1 from public.project_costs c where c.project_id = p.id and c.kind = x.kind and c.created_at = u.updated_at);

-- 3) new project documents join their client's project (created if needed), so the old editors work as before
create or replace function private.link_project_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  cname text := trim(coalesce(new.client_name, ''));
begin
  if new.project_id is not null or cname = '' then return new; end if;
  if coalesce(new.payload->>'dashboardScope', 'main') <> 'project' then return new; end if;
  if coalesce((new.payload->>'usageTrackingRecord')::boolean, false) then return new; end if;
  select id into pid from public.projects
    where lower(trim(client_name)) = lower(cname)
    order by (stage in ('closed', 'cancelled')), created_at desc limit 1;
  if pid is null then
    insert into public.projects (client_name, category, client_phone, client_email, start_date, due_date, created_by)
    values (cname, nullif(new.payload->>'projectCategory', '') , nullif(new.payload->>'clientPhone', ''), nullif(new.payload->>'clientEmail', ''),
      coalesce(new.issue_date, current_date), new.due_date, new.created_by)
    returning id into pid;
  end if;
  new.project_id := pid;
  return new;
end
$$;
drop trigger if exists link_project_document on public.invoices;
create trigger link_project_document
  before insert or update of client_name, payload on public.invoices
  for each row execute function private.link_project_document();
