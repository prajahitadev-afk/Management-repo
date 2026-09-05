-- Align Orders approval/read RLS with the existing Marketing workflow.
-- Run after supabase_phase2_setup.sql.
-- MD-Transport is added only to the order read/update paths required for approval.

drop policy if exists orders_select_authorized on public.orders;
drop policy if exists order_items_select_authorized on public.order_items;
drop policy if exists orders_update_authorized on public.orders;

create policy orders_select_authorized on public.orders
for select to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Manager', 'Chief Manager', 'General Manager', 'Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD', 'Vice Chairman', 'Vice President')
  )
);

create policy order_items_select_authorized on public.order_items
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('Manager', 'Chief Manager', 'General Manager', 'Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD', 'Vice Chairman', 'Vice President')
        )
      )
  )
);

create policy orders_update_authorized on public.orders
for update to authenticated
using (
  (
    created_by = auth.uid()
    and status not in ('Approved', 'Returned')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'MD-Transport', 'General Manager')
  )
)
with check (
  (
    created_by = auth.uid()
    and status not in ('Approved', 'Returned')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'MD-Transport', 'General Manager')
  )
);
