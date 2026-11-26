-- Documents (invoices, quotations, delivery notes, technical reports): proper tables for money and
-- project usage, and real columns for what lists filter on. All server only (RLS on, no policies).

-- 1) columns read from the document JSON, kept by Postgres itself (always in step, indexable)
alter table public.invoices
  add column if not exists document_kind text generated always as (coalesce(nullif(payload->>'documentKind', ''), 'invoice')) stored,
  add column if not exists dashboard_scope text generated always as (coalesce(nullif(payload->>'dashboardScope', ''), 'main')) stored,
  add column if not exists is_void boolean generated always as (coalesce((payload->>'voided')::boolean, false)) stored,
  add column if not exists is_hidden boolean generated always as (coalesce((payload->>'hiddenFromList')::boolean, false)) stored,
  add column if not exists is_usage_record boolean generated always as (coalesce((payload->>'usageTrackingRecord')::boolean, false)) stored;
create index if not exists invoices_kind_scope_idx on public.invoices (document_kind, dashboard_scope, created_at desc) where not is_usage_record;

-- 2) payments: one row per payment (no more lost updates when two people save at once)
create table if not exists public.document_payments (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  note text,
  legacy_id text unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists document_payments_invoice_idx on public.document_payments (invoice_id, seq);
alter table public.document_payments enable row level security;
revoke all on public.document_payments from anon, authenticated;

insert into public.document_payments (invoice_id, amount, paid_on, note, legacy_id)
select i.id, (r.rec->>'amount')::numeric, (substring(r.rec->>'date' from 1 for 10))::date, nullif(r.rec->>'note', ''), r.rec->>'id'
from public.invoices i
cross join lateral jsonb_array_elements(case when jsonb_typeof(i.payload->'payments'->'records') = 'array' then i.payload->'payments'->'records' else '[]'::jsonb end) with ordinality as r(rec, n)
where not exists (select 1 from public.document_payments d where d.legacy_id = r.rec->>'id')
order by i.id, r.n;

-- the document's payment list is always rebuilt from the table (old screens keep reading it there;
-- nobody can overwrite payments by saving an old copy of the document)
create or replace function private.invoice_payments_from_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.payload := jsonb_set(coalesce(new.payload, '{}'::jsonb), '{payments}', jsonb_build_object(
    'records', coalesce((
      select jsonb_agg(jsonb_build_object('id', coalesce(p.legacy_id, p.id::text), 'date', to_char(p.paid_on, 'YYYY-MM-DD'), 'amount', p.amount, 'note', coalesce(p.note, '')) order by p.seq)
      from public.document_payments p where p.invoice_id = new.id), '[]'::jsonb),
    'note', coalesce(new.payload->'payments'->>'note', '')
  ));
  return new;
end
$$;
drop trigger if exists invoice_payments_from_table on public.invoices;
create trigger invoice_payments_from_table
  before insert or update on public.invoices
  for each row execute function private.invoice_payments_from_table();

create or replace function private.touch_invoice_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices set updated_at = now() where id = coalesce(new.invoice_id, old.invoice_id);
  return null;
end
$$;
drop trigger if exists touch_invoice_after_payment on public.document_payments;
create trigger touch_invoice_after_payment
  after insert or delete on public.document_payments
  for each row execute function private.touch_invoice_after_payment();

-- 3) project usage: its own table instead of hidden "fake invoices"
create table if not exists public.project_usage (
  client_name text primary key,
  component_usage numeric(14,2) not null default 0 check (component_usage >= 0),
  prototype_usage numeric(14,2) not null default 0 check (prototype_usage >= 0),
  service_used numeric(14,2) not null default 0 check (service_used >= 0),
  component_note text not null default '',
  prototype_note text not null default '',
  service_note text not null default '',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.project_usage enable row level security;
revoke all on public.project_usage from anon, authenticated;

insert into public.project_usage (client_name, component_usage, prototype_usage, service_used, component_note, prototype_note, service_note, updated_at)
select trim(client_name),
  coalesce((payload->'projectUsageEntry'->>'componentUsage')::numeric, 0),
  coalesce((payload->'projectUsageEntry'->>'prototypeUsage')::numeric, 0),
  coalesce((payload->'projectUsageEntry'->>'serviceUsed')::numeric, 0),
  coalesce(payload->'projectUsageEntry'->>'componentNote', ''),
  coalesce(payload->'projectUsageEntry'->>'prototypeNote', ''),
  coalesce(payload->'projectUsageEntry'->>'serviceNote', ''),
  coalesce(updated_at, now())
from public.invoices
where payload->>'usageTrackingRecord' = 'true' and coalesce(trim(client_name), '') <> ''
on conflict (client_name) do nothing;
-- the old hidden usage rows stay untouched (backup); nothing reads them any more
