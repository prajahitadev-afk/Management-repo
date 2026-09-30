-- Phase 2.6: Notifications enhancements — escalation, forwarding, audit
alter table if exists public.notifications
add column if not exists notification_type varchar(100);

alter table if exists public.notifications
add column if not exists forwarded_from uuid references public.profiles(id);

alter table if exists public.notifications
add column if not exists forwarded_to uuid references public.profiles(id);

alter table if exists public.notifications
add column if not exists forwarded_at timestamptz;

alter table if exists public.notifications
add column if not exists is_forwarded boolean default false;

alter table if exists public.notifications
add column if not exists parent_notification_id uuid references public.notifications(id);

-- optional index to speed parent lookups
create index if not exists idx_notifications_parent on public.notifications(parent_notification_id);

-- ensure action_url exists (defensive; may have been added earlier)
alter table if exists public.notifications
add column if not exists action_url text;

-- grant insert/select for authenticated users (review RLS in prod)
grant select, insert, update on public.notifications to authenticated;

-- end migration
