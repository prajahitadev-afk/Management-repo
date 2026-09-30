-- Explicit employee reporting relationships.
-- department_id is text because the current ERP has no departments table or department UUIDs.
create table if not exists public.employee_hierarchy (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  supervisor_id uuid not null references public.profiles(id) on delete restrict,
  hierarchy_level integer not null check (hierarchy_level > 0),
  department_id text not null,
  created_at timestamptz not null default now(),
  constraint employee_hierarchy_employee_unique unique (employee_id),
  constraint employee_hierarchy_no_self_reporting check (employee_id <> supervisor_id)
);

create index if not exists employee_hierarchy_supervisor_id_idx
  on public.employee_hierarchy(supervisor_id);

create index if not exists employee_hierarchy_department_id_idx
  on public.employee_hierarchy(department_id);

create or replace function public.prevent_employee_hierarchy_cycle()
returns trigger
language plpgsql
as $$
declare
  cycle_found boolean;
begin
  if new.employee_id = new.supervisor_id then
    raise exception 'An employee cannot report to themselves';
  end if;

  with recursive ancestors(id) as (
    select new.supervisor_id
    union all
    select hierarchy.supervisor_id
    from public.employee_hierarchy hierarchy
    join ancestors on ancestors.id = hierarchy.employee_id
  )
  select exists (
    select 1 from ancestors where id = new.employee_id
  ) into cycle_found;

  if cycle_found then
    raise exception 'Employee hierarchy cannot contain circular reporting chains';
  end if;

  return new;
end;
$$;

drop trigger if exists employee_hierarchy_cycle_guard on public.employee_hierarchy;
create trigger employee_hierarchy_cycle_guard
before insert or update of employee_id, supervisor_id
on public.employee_hierarchy
for each row execute function public.prevent_employee_hierarchy_cycle();

alter table public.employee_hierarchy enable row level security;

create policy employee_hierarchy_select_authenticated
on public.employee_hierarchy
for select to authenticated
using (true);

create policy employee_hierarchy_insert_authenticated
on public.employee_hierarchy
for insert to authenticated
with check (true);

create policy employee_hierarchy_update_authenticated
on public.employee_hierarchy
for update to authenticated
using (true)
with check (true);
