-- Leave Management module
-- Run after profiles, employee_hierarchy, notifications, and audit_logs exist.

create extension if not exists pgcrypto;

-- The existing audit schema was originally profile-only; leave requests need
-- to be valid audit entities as well.
alter table if exists public.audit_logs drop constraint if exists audit_logs_entity_id_fkey;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  leave_type text not null check (leave_type in ('Casual', 'Sick', 'Earned', 'Unpaid')),
  start_date date not null,
  end_date date not null,
  total_days integer not null check (total_days > 0),
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  current_approver_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.leave_approval_history (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('Approved', 'Rejected', 'Cancelled')),
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.profiles(id) on delete cascade,
  casual_leave numeric(6,2) not null default 0 check (casual_leave >= 0),
  sick_leave numeric(6,2) not null default 0 check (sick_leave >= 0),
  earned_leave numeric(6,2) not null default 0 check (earned_leave >= 0),
  unpaid_leave numeric(6,2) not null default 0 check (unpaid_leave >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id, created_at desc);
create index if not exists leave_requests_approver_status_idx on public.leave_requests(current_approver_id, status, created_at desc);
create index if not exists leave_requests_status_dates_idx on public.leave_requests(status, start_date, end_date);
create index if not exists leave_approval_history_request_idx on public.leave_approval_history(leave_request_id, created_at desc);
create index if not exists leave_approval_history_approver_idx on public.leave_approval_history(approver_id, created_at desc);

create or replace function public.leave_days(p_start date, p_end date)
returns integer
language sql
immutable
as $$
  select (p_end - p_start) + 1;
$$;

create or replace function public.leave_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'Worker' then 1
    when 'Supervisor' then 2
    when 'Manager' then 3
    when 'Chief Manager' then 4
    when 'General Manager' then 5
    when 'Managing Director' then 6
    when 'MD-Manufacturing' then 6
    when 'MD-Marketing' then 6
    when 'MD-Transport' then 6
    when 'MD-RD' then 6
    when 'President' then 7
    when 'Vice President' then 7
    when 'Vice Chairman' then 8
    else 0
  end;
$$;

create or replace function public.leave_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_leave_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id, type, title, message, related_entity_type,
    related_entity_id, action_url, is_read, created_at
  ) values (
    p_user_id, p_type, p_title, p_message, 'leave_request',
    p_leave_id::text, '/leave', false, now()
  );
end;
$$;

create or replace function public.leave_audit(
  p_actor_id uuid,
  p_action text,
  p_leave_id uuid,
  p_old_values jsonb,
  p_new_values jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
  values (p_actor_id, p_action, 'leave_request', p_leave_id, p_old_values, p_new_values);
end;
$$;

create or replace function public.submit_leave_request(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := auth.uid();
  v_approver_id uuid;
  v_request_id uuid;
  v_total_days integer;
begin
  if v_employee_id is null then raise exception 'Authentication required'; end if;
  if p_leave_type not in ('Casual', 'Sick', 'Earned', 'Unpaid') then raise exception 'Invalid leave type'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then raise exception 'Invalid leave dates'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Leave reason is required'; end if;

  select reports_to into v_approver_id from public.profiles where id = v_employee_id;
  if v_approver_id is null then raise exception 'A reporting supervisor is required before submitting leave'; end if;
  v_total_days := public.leave_days(p_start_date, p_end_date);

  if exists (
    select 1 from public.leave_requests
    where employee_id = v_employee_id and status = 'Pending'
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then raise exception 'An overlapping pending leave request already exists'; end if;

  insert into public.leave_balances (employee_id) values (v_employee_id) on conflict (employee_id) do nothing;
  insert into public.leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason, current_approver_id)
  values (v_employee_id, p_leave_type, p_start_date, p_end_date, v_total_days, trim(p_reason), v_approver_id)
  returning id into v_request_id;

  perform public.leave_notification(v_approver_id, 'leave_submitted', 'Leave request requires approval', 'A leave request is waiting for your approval.', v_request_id);
  perform public.leave_audit(v_employee_id, 'leave_submitted', v_request_id, null, jsonb_build_object('status', 'Pending', 'current_approver_id', v_approver_id, 'total_days', v_total_days));
  return v_request_id;
end;
$$;

create or replace function public.update_leave_request(
  p_leave_id uuid,
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.leave_requests%rowtype;
  v_total_days integer;
begin
  select * into v_request from public.leave_requests where id = p_leave_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if v_request.employee_id <> auth.uid() then raise exception 'You may only update your own leave request'; end if;
  if v_request.status <> 'Pending' then raise exception 'Only pending leave requests can be updated'; end if;
  if p_leave_type not in ('Casual', 'Sick', 'Earned', 'Unpaid') then raise exception 'Invalid leave type'; end if;
  if p_end_date < p_start_date then raise exception 'Invalid leave dates'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Leave reason is required'; end if;
  v_total_days := public.leave_days(p_start_date, p_end_date);

  update public.leave_requests set leave_type = p_leave_type, start_date = p_start_date, end_date = p_end_date,
    total_days = v_total_days, reason = trim(p_reason), updated_at = now() where id = p_leave_id;
  perform public.leave_audit(auth.uid(), 'leave_updated', p_leave_id,
    jsonb_build_object('leave_type', v_request.leave_type, 'start_date', v_request.start_date, 'end_date', v_request.end_date, 'total_days', v_request.total_days, 'reason', v_request.reason),
    jsonb_build_object('leave_type', p_leave_type, 'start_date', p_start_date, 'end_date', p_end_date, 'total_days', v_total_days, 'reason', trim(p_reason)));
  return p_leave_id;
end;
$$;

create or replace function public.review_leave_request(
  p_leave_id uuid,
  p_decision text,
  p_remarks text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.leave_requests%rowtype;
  v_actor_role text;
  v_next_approver uuid;
  v_old jsonb;
  v_new_status text;
begin
  select * into v_request from public.leave_requests where id = p_leave_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if v_request.status <> 'Pending' then raise exception 'Only pending leave requests can be reviewed'; end if;
  if v_request.current_approver_id <> auth.uid() then raise exception 'This leave request is not assigned to you'; end if;
  if p_decision not in ('Approved', 'Rejected') then raise exception 'Invalid leave decision'; end if;

  select role into v_actor_role from public.profiles where id = auth.uid();
  if public.leave_role_rank(v_actor_role) <= public.leave_role_rank((select role from public.profiles where id = v_request.employee_id)) then
    raise exception 'Approver must be senior to the employee';
  end if;
  v_old := jsonb_build_object('status', v_request.status, 'current_approver_id', v_request.current_approver_id);

  if p_decision = 'Rejected' then
    update public.leave_requests set status = 'Rejected', current_approver_id = null, updated_at = now() where id = p_leave_id returning * into v_request;
    insert into public.leave_approval_history (leave_request_id, approver_id, action, remarks) values (p_leave_id, auth.uid(), 'Rejected', nullif(trim(p_remarks), ''));
    perform public.leave_notification(v_request.employee_id, 'leave_rejected', 'Leave request rejected', coalesce(nullif(trim(p_remarks), ''), 'Your leave request was rejected.'), p_leave_id);
    perform public.leave_audit(auth.uid(), 'leave_rejected', p_leave_id, v_old, jsonb_build_object('status', 'Rejected', 'remarks', p_remarks));
    return v_request;
  end if;

  insert into public.leave_approval_history (leave_request_id, approver_id, action, remarks) values (p_leave_id, auth.uid(), 'Approved', nullif(trim(p_remarks), ''));
  select reports_to into v_next_approver from public.profiles where id = auth.uid();
  if v_actor_role in ('Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD') then
    v_new_status := 'Approved';
    update public.leave_requests set status = v_new_status, current_approver_id = null, updated_at = now() where id = p_leave_id returning * into v_request;
    insert into public.leave_balances (employee_id) values (v_request.employee_id) on conflict (employee_id) do nothing;
    if v_request.leave_type = 'Casual' then update public.leave_balances set casual_leave = casual_leave - v_request.total_days, updated_at = now() where employee_id = v_request.employee_id and casual_leave >= v_request.total_days;
    elsif v_request.leave_type = 'Sick' then update public.leave_balances set sick_leave = sick_leave - v_request.total_days, updated_at = now() where employee_id = v_request.employee_id and sick_leave >= v_request.total_days;
    elsif v_request.leave_type = 'Earned' then update public.leave_balances set earned_leave = earned_leave - v_request.total_days, updated_at = now() where employee_id = v_request.employee_id and earned_leave >= v_request.total_days;
    else update public.leave_balances set unpaid_leave = unpaid_leave + v_request.total_days, updated_at = now() where employee_id = v_request.employee_id;
    end if;
    if v_request.leave_type <> 'Unpaid' and not found then raise exception 'Insufficient leave balance'; end if;
  else
    if v_next_approver is null then raise exception 'Next approver is not configured'; end if;
    update public.leave_requests set current_approver_id = v_next_approver, updated_at = now() where id = p_leave_id returning * into v_request;
    perform public.leave_notification(v_next_approver, 'leave_submitted', 'Leave request requires approval', 'A leave request is waiting for your approval.', p_leave_id);
  end if;

  if v_request.status = 'Approved' then
    perform public.leave_notification(v_request.employee_id, 'leave_approved', 'Leave request approved', 'Your leave request has been approved.', p_leave_id);
  end if;
  perform public.leave_audit(auth.uid(), 'leave_approved', p_leave_id, v_old, jsonb_build_object('status', v_request.status, 'current_approver_id', v_request.current_approver_id));
  return v_request;
end;
$$;

create or replace function public.cancel_leave_request(p_leave_id uuid)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare v_request public.leave_requests%rowtype;
begin
  select * into v_request from public.leave_requests where id = p_leave_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if v_request.employee_id <> auth.uid() or v_request.status <> 'Pending' then raise exception 'Only your pending leave requests can be cancelled'; end if;
  update public.leave_requests set status = 'Cancelled', current_approver_id = null, updated_at = now() where id = p_leave_id returning * into v_request;
  insert into public.leave_approval_history (leave_request_id, approver_id, action, remarks) values (p_leave_id, auth.uid(), 'Cancelled', null);
  perform public.leave_audit(auth.uid(), 'leave_cancelled', p_leave_id, jsonb_build_object('status', 'Pending'), jsonb_build_object('status', 'Cancelled'));
  return v_request;
end;
$$;

alter table public.leave_requests enable row level security;
alter table public.leave_approval_history enable row level security;
alter table public.leave_balances enable row level security;

drop policy if exists leave_requests_select_participants on public.leave_requests;
create policy leave_requests_select_participants on public.leave_requests for select to authenticated using (employee_id = auth.uid() or current_approver_id = auth.uid() or exists (select 1 from public.leave_approval_history h where h.leave_request_id = id and h.approver_id = auth.uid()));
drop policy if exists leave_history_select_participants on public.leave_approval_history;
create policy leave_history_select_participants on public.leave_approval_history for select to authenticated using (approver_id = auth.uid() or exists (select 1 from public.leave_requests r where r.id = leave_request_id and r.employee_id = auth.uid()));
drop policy if exists leave_balances_select_owner on public.leave_balances;
create policy leave_balances_select_owner on public.leave_balances for select to authenticated using (employee_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and public.leave_role_rank(p.role) >= 2));

grant select on public.leave_requests, public.leave_approval_history, public.leave_balances to authenticated;
grant execute on function public.submit_leave_request(text, date, date, text) to authenticated;
grant execute on function public.update_leave_request(uuid, text, date, date, text) to authenticated;
grant execute on function public.review_leave_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_leave_request(uuid) to authenticated;

-- These helpers are callable only by the leave workflow functions above.
revoke execute on function public.leave_notification(uuid, text, text, text, uuid) from public;
revoke execute on function public.leave_audit(uuid, text, uuid, jsonb, jsonb) from public;