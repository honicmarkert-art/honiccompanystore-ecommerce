-- =====================================================================================
-- Email consent (2026-11-25)
--  * Newsletter / promotions use double opt-in: a subscription starts as 'pending' and becomes
--    'active' only when the person clicks the confirmation link. We keep when and where consent
--    was given (confirmed_at, source, consent_ip).
--  * email_preferences: one row per email address (guests too), holding opt-outs for alerts and
--    reminders. Promotional columns default to OFF (they defaulted to ON, which is not consent).
-- Additive only: no rows are deleted. Existing subscribers keep status 'active' but have no
-- confirmed_at, so promotional sends skip them until they confirm.
-- =====================================================================================
begin;

alter table public.newsletter_subscriptions drop constraint if exists newsletter_subscriptions_status_check;
alter table public.newsletter_subscriptions
  add constraint newsletter_subscriptions_status_check check (status in ('pending', 'active', 'unsubscribed', 'bounced'));
alter table public.newsletter_subscriptions
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists consent_ip text;

alter table public.email_preferences alter column user_id drop not null;
alter table public.email_preferences alter column marketing_emails set default false;
alter table public.email_preferences alter column newsletter set default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'email_preferences_email_key') then
    alter table public.email_preferences add constraint email_preferences_email_key unique (email);
  end if;
end $$;

commit;
