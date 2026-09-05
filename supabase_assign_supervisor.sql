-- Audit support for employee reporting-relationship changes.
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

create index if not exists audit_logs_entity_id_idx
  on public.audit_logs(entity_id);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_select_authenticated
on public.audit_logs
for select to authenticated
using (true);

create policy audit_logs_insert_actor
on public.audit_logs
for insert to authenticated
with check (actor_id = auth.uid());

create or replace function public.assign_employee_supervisor(
  p_employee_id uuid,
  p_supervisor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_level integer;
  supervisor_level integer;
  employee_department text;
  existing_supervisor uuid;
  hierarchy_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_employee_id = p_supervisor_id then
    raise exception 'An employee cannot report to themselves';
  end if;

  select hierarchy_level, department into employee_level, employee_department
  from public.profiles where id = p_employee_id;
  select hierarchy_level into supervisor_level
  from public.profiles where id = p_supervisor_id;

  if employee_level is null or supervisor_level is null then
    raise exception 'Both employees must have a valid hierarchy level';
  end if;
  if supervisor_level <= employee_level then
    raise exception 'Supervisor must have a higher hierarchy level';
  end if;

  select supervisor_id into existing_supervisor
  from public.employee_hierarchy where employee_id = p_employee_id;

  insert into public.employee_hierarchy (employee_id, supervisor_id, hierarchy_level, department_id)
  values (p_employee_id, p_supervisor_id, employee_level, coalesce(employee_department, 'Administration'))
  on conflict (employee_id) do update set
    supervisor_id = excluded.supervisor_id,
    hierarchy_level = excluded.hierarchy_level,
    department_id = excluded.department_id
  returning id into hierarchy_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
  values (
    auth.uid(),
    case when existing_supervisor is null then 'employee_supervisor_assigned' else 'employee_supervisor_updated' end,
    'employee_hierarchy',
    p_employee_id,
    case when existing_supervisor is null then null else jsonb_build_object('supervisor_id', existing_supervisor) end,
    jsonb_build_object('supervisor_id', p_supervisor_id, 'hierarchy_level', employee_level)
  );

  return hierarchy_id;
end;
$$;

grant execute on function public.assign_employee_supervisor(uuid, uuid) to authenticated;
