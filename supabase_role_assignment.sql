-- Atomic role assignment using the existing profiles.role field.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null references public.profiles(id) on delete cascade,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_type_idx on public.audit_logs(entity_type);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_authenticated on public.audit_logs;
create policy audit_logs_select_authenticated
on public.audit_logs for select to authenticated using (true);

drop policy if exists audit_logs_insert_actor on public.audit_logs;
create policy audit_logs_insert_actor
on public.audit_logs for insert to authenticated
with check (actor_id = auth.uid());

create or replace function public.assign_employee_role(
  p_employee_id uuid,
  p_role text,
  p_assigned_by uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  old_role text;
  current_supervisor uuid;
  actor_level integer;
  target_level integer;
  supervisor_level integer;
  normalized_role text := trim(p_role);
begin
  if auth.uid() is null or p_assigned_by <> auth.uid() then
    raise exception 'Authentication required';
  end if;

  if normalized_role not in ('Vice Chairman', 'President', 'Managing Director', 'General Manager', 'Chief Manager', 'Manager', 'Supervisor', 'Worker') then
    raise exception 'Invalid employee role';
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  select role into old_role from public.profiles where id = p_employee_id for update;
  if old_role is null then raise exception 'Employee profile not found'; end if;

  actor_level := case actor_role
    when 'Vice Chairman' then 8 when 'President' then 7 when 'Vice President' then 7
    when 'Managing Director' then 6 when 'General Manager' then 5
    when 'Chief Manager' then 4 when 'Manager' then 3 when 'Supervisor' then 2 else 1 end;
  target_level := case normalized_role
    when 'Vice Chairman' then 8 when 'President' then 7 when 'Managing Director' then 6
    when 'General Manager' then 5 when 'Chief Manager' then 4 when 'Manager' then 3
    when 'Supervisor' then 2 else 1 end;

  if actor_role is null or actor_level <= target_level or actor_role not in ('Vice Chairman', 'President', 'Vice President', 'Managing Director', 'General Manager', 'Chief Manager', 'Manager') then
    raise exception 'You are not authorized to assign this role';
  end if;

  if p_employee_id = auth.uid() then raise exception 'You cannot assign a role to yourself'; end if;
  if old_role = 'Vice Chairman' then raise exception 'The Vice Chairman role is protected'; end if;

  select h.supervisor_id, p.hierarchy_level into current_supervisor, supervisor_level
  from public.employee_hierarchy h
  join public.profiles p on p.id = h.supervisor_id
  where h.employee_id = p_employee_id;

  if current_supervisor is not null and supervisor_level <= target_level then
    raise exception 'Assigned role would violate the reporting hierarchy';
  end if;

  update public.profiles set role = normalized_role, hierarchy_level = target_level where id = p_employee_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), 'employee_role_changed', 'profile', p_employee_id,
    jsonb_build_object('role', old_role), jsonb_build_object('role', normalized_role, 'hierarchy_level', target_level));

  return normalized_role;
end;
$$;

grant execute on function public.assign_employee_role(uuid, text, uuid) to authenticated;
