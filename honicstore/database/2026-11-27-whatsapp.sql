-- =====================================================================================
-- 2026-11-27: WhatsApp Business (Cloud API)
--  whatsapp_contacts : consent per phone number (order updates / offers), opt-out time, and the
--                      last time the customer wrote to us (free-text replies allowed for 24 h).
--  whatsapp_messages : every message we send (template, status sent/delivered/read/failed, error)
--                      so the team can see what reached customers.
-- Server access only (RLS on, no policies). Additive.
-- =====================================================================================
begin;

create table if not exists public.whatsapp_contacts (
  phone text primary key,                       -- 255XXXXXXXXX
  name text,
  user_id uuid,
  updates_opt_in boolean not null default false,   -- order updates (utility templates)
  marketing_opt_in boolean not null default false, -- offers / ads (marketing templates)
  updates_opted_in_at timestamptz,
  marketing_opted_in_at timestamptz,
  opted_out_at timestamptz,
  source text,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_contacts_marketing on public.whatsapp_contacts (marketing_opt_in) where marketing_opt_in;
alter table public.whatsapp_contacts enable row level security;
revoke all on public.whatsapp_contacts from anon, authenticated;

create table if not exists public.whatsapp_messages (
  id bigserial primary key,
  wa_message_id text unique,
  phone text not null,
  kind text not null,          -- order_paid, order_shipped, campaign, offer_reply, text ...
  template text,
  ref text,                    -- order number / offer ref / campaign id
  status text not null default 'sent',   -- sent, delivered, read, failed
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_phone on public.whatsapp_messages (phone, created_at desc);
create index if not exists whatsapp_messages_kind on public.whatsapp_messages (kind, created_at desc);
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_messages from anon, authenticated;

commit;
