-- Admin app: refunds on cancelled paid orders, seller payouts, and resumable marketing campaigns.
-- All new tables are server-only: RLS on with NO policies, so only the service role (admin app) can use them.
-- Safe to run more than once.

begin;

-- 1) Refunds: a cancelled PAID order is "refund due" until the admin records the refund.
alter table public.orders add column if not exists refund_status text;         -- null | 'due' | 'paid'
alter table public.orders add column if not exists refund_amount numeric;
alter table public.orders add column if not exists refund_reference text;     -- mobile money / bank transaction id
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists refunded_by uuid;
do $$ begin
  alter table public.orders add constraint orders_refund_status_check check (refund_status is null or refund_status in ('due', 'paid'));
exception when duplicate_object then null; end $$;
-- earlier cancelled paid orders: mark them due so none is forgotten
update public.orders set refund_status = 'due', refund_amount = total_amount
 where status = 'cancelled' and payment_status = 'paid' and refund_status is null;

-- 2) Seller payouts: what Honic paid each seller (earnings are computed from delivered items).
create table if not exists public.supplier_payouts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  method text not null,                 -- mobile money / bank
  reference text not null,              -- transaction id
  note text,
  paid_at timestamptz not null default now(),
  paid_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists supplier_payouts_supplier_idx on public.supplier_payouts (supplier_id, paid_at desc);
alter table public.supplier_payouts enable row level security;

-- 3) Campaigns (email / WhatsApp): the message is stored once, then sent in small batches. Every
--    recipient gets one row, so a resend never messages the same person twice and a stopped send
--    can be continued where it stopped.
create table if not exists public.marketing_campaigns (
  id text primary key,
  channel text not null check (channel in ('email', 'whatsapp')),
  payload jsonb not null,
  status text not null default 'sending' check (status in ('sending', 'done')),
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create table if not exists public.marketing_campaign_recipients (
  campaign_id text not null references public.marketing_campaigns(id) on delete cascade,
  recipient text not null,
  status text not null,                 -- sent | failed | skipped
  error text,
  created_at timestamptz not null default now(),
  primary key (campaign_id, recipient)
);
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;

commit;
