-- Employee KPI management for role-scoped dashboards.
create table if not exists public.employee_kpis (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  metric_name text not null check (length(trim(metric_name)) > 0),
  target_value numeric not null check (target_value >= 0),
  achieved_value numeric not null default 0 check (achieved_value >= 0),
  review_month integer not null check (review_month between 1 and 12),
  review_year integer not null check (review_year between 2000 and 2200),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Approved', 'Rejected')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_kpis_employee_period_idx on public.employee_kpis(employee_id, review_year desc, review_month desc);
create index if not exists employee_kpis_assigned_by_idx on public.employee_kpis(assigned_by, review_year desc, review_month desc);

alter table public.employee_kpis enable row level security;
create policy employee_kpis_select_authenticated on public.employee_kpis for select to authenticated using (employee_id = auth.uid() or assigned_by = auth.uid() or reviewed_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('General Manager', 'Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD', 'President', 'Vice President', 'Vice Chairman')));
create policy employee_kpis_insert_manager on public.employee_kpis for insert to authenticated with check (assigned_by = auth.uid());
create policy employee_kpis_update_owner_or_reviewer on public.employee_kpis for update to authenticated using (employee_id = auth.uid() or exists (select 1 from public.employee_hierarchy h where h.employee_id = employee_kpis.employee_id and h.supervisor_id = auth.uid())) with check (employee_id = auth.uid() or exists (select 1 from public.employee_hierarchy h where h.employee_id = employee_kpis.employee_id and h.supervisor_id = auth.uid()));

create or replace function public.assign_employee_kpi(p_employee_id uuid, p_metric_name text, p_target_value numeric, p_review_month integer, p_review_year integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor_role text; kpi_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role not in ('Manager', 'Chief Manager', 'General Manager', 'Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD', 'President', 'Vice President', 'Vice Chairman') then raise exception 'Only managers and above can assign KPIs'; end if;
  if p_employee_id = auth.uid() then raise exception 'You cannot assign a KPI to yourself'; end if;
  if p_target_value < 0 or p_review_month not between 1 and 12 or p_review_year not between 2000 and 2200 or length(trim(p_metric_name)) = 0 then raise exception 'Invalid KPI values'; end if;
  if actor_role in ('Manager', 'Chief Manager') and not exists (select 1 from public.employee_hierarchy h where h.employee_id = p_employee_id and h.supervisor_id = auth.uid()) then raise exception 'You can assign KPIs only to employees in your reporting line'; end if;
  insert into public.employee_kpis(employee_id, assigned_by, metric_name, target_value, review_month, review_year) values (p_employee_id, auth.uid(), trim(p_metric_name), p_target_value, p_review_month, p_review_year) returning id into kpi_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_values) values (auth.uid(), 'employee_kpi_assigned', 'employee_kpi', p_employee_id, jsonb_build_object('kpi_id', kpi_id, 'metric_name', trim(p_metric_name), 'target_value', p_target_value, 'review_month', p_review_month, 'review_year', p_review_year));
  return kpi_id;
end;
$$;

grant execute on function public.assign_employee_kpi(uuid, text, numeric, integer, integer) to authenticated;

create or replace function public.update_employee_kpi_progress(p_kpi_id uuid, p_achieved_value numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare kpi_employee uuid;
begin
  if auth.uid() is null or p_achieved_value < 0 then raise exception 'Invalid KPI progress'; end if;
  select employee_id into kpi_employee from public.employee_kpis where id = p_kpi_id;
  if kpi_employee <> auth.uid() then raise exception 'Only the assigned employee can update KPI progress'; end if;
  update public.employee_kpis set achieved_value = p_achieved_value, status = 'In Progress', updated_at = now() where id = p_kpi_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_values) values (auth.uid(), 'employee_kpi_progress_updated', 'employee_kpi', kpi_employee, jsonb_build_object('kpi_id', p_kpi_id, 'achieved_value', p_achieved_value));
  return p_kpi_id;
end;
$$;

grant execute on function public.update_employee_kpi_progress(uuid, numeric) to authenticated;

create or replace function public.review_employee_kpi(p_kpi_id uuid, p_decision text, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare kpi_employee uuid;
begin
  if auth.uid() is null or p_decision not in ('Approved', 'Rejected') then raise exception 'Invalid KPI review'; end if;
  select employee_id into kpi_employee from public.employee_kpis where id = p_kpi_id and exists (select 1 from public.employee_hierarchy h where h.employee_id = employee_kpis.employee_id and h.supervisor_id = auth.uid());
  if kpi_employee is null then raise exception 'Only the employee''s direct supervisor can review this KPI'; end if;
  update public.employee_kpis set status = p_decision, reviewed_by = auth.uid(), review_comment = p_comment, updated_at = now() where id = p_kpi_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_values) values (auth.uid(), 'employee_kpi_' || lower(p_decision), 'employee_kpi', kpi_employee, jsonb_build_object('kpi_id', p_kpi_id, 'decision', p_decision, 'comment', p_comment));
  return p_kpi_id;
end;
$$;

grant execute on function public.review_employee_kpi(uuid, text, text) to authenticated;
