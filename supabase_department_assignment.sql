-- Department assignment history for the existing profiles.department field.
create table if not exists public.employee_department_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  previous_department text,
  new_department text not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists employee_department_history_employee_id_idx
  on public.employee_department_history(employee_id);

create index if not exists employee_department_history_created_at_idx
  on public.employee_department_history(created_at desc);

alter table public.employee_department_history enable row level security;

create policy employee_department_history_select_authenticated
on public.employee_department_history
for select to authenticated
using (true);

create policy employee_department_history_insert_actor
on public.employee_department_history
for insert to authenticated
with check (changed_by = auth.uid());

create or replace function public.assign_employee_department(
  p_employee_id uuid,
  p_department text,
  p_changed_by uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_department text;
  normalized_department text;
begin
  if auth.uid() is null or p_changed_by <> auth.uid() then
    raise exception 'Authentication required';
  end if;

  normalized_department := case lower(trim(p_department))
    when 'manufacturing' then 'Manufacturing'
    when 'marketing' then 'Marketing'
    when 'transport' then 'Transportation'
    when 'transportation' then 'Transportation'
    when 'research and development' then 'Research and Development'
    when 'research & development' then 'Research and Development'
    else null
  end;

  if normalized_department is null then
    raise exception 'Invalid department';
  end if;

  select department into old_department
  from public.profiles
  where id = p_employee_id
  for update;

  if old_department is null then
    raise exception 'Employee profile not found';
  end if;

  if old_department = normalized_department then
    return normalized_department;
  end if;

  update public.profiles
  set department = normalized_department
  where id = p_employee_id;

  insert into public.employee_department_history (employee_id, previous_department, new_department, changed_by)
  values (p_employee_id, old_department, normalized_department, p_changed_by);

  return normalized_department;
end;
$$;

grant execute on function public.assign_employee_department(uuid, text, uuid) to authenticated;
