-- Phase 2 Supabase setup
-- Run in the Supabase SQL editor after confirming the existing column names.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('bill-attachments', 'bill-attachments', false)
on conflict (id) do update set public = excluded.public;

create or replace function public.create_order_with_items(
  p_order_number text,
  p_customer_id uuid,
  p_order_date date,
  p_expected_delivery date,
  p_status text,
  p_total_amount numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_now timestamptz := now();
begin
  insert into public.orders (
    order_number, customer_id, order_date, expected_delivery,
    status, total_amount, created_by
  ) values (
    p_order_number, p_customer_id, p_order_date, p_expected_delivery,
    p_status, p_total_amount, auth.uid()
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select v_order_id, item.product_id, item.quantity, item.unit_price
  from jsonb_to_recordset(p_items) as item(
    product_id uuid,
    quantity integer,
    unit_price numeric
  );

  update public.products
  set stock_quantity = products.stock_quantity - totals.total_quantity
  from (
    select item.product_id, sum(item.quantity) as total_quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
    group by item.product_id
  ) as totals
  where products.id = totals.product_id;

  insert into public.notifications (
    user_id, sender_role, event_type, title, message, related_id,
    payload, notification_type, action_url, read, created_at
  )
  select p.id, 'System', 'inventory_shortage',
    concat('Low stock alert: ', prod.name),
    concat(prod.name, ' stock is now ', (prod.stock_quantity - totals.total_quantity)::text, ' units after order ', p_order_number, '.'),
    prod.id::text,
    json_build_object('order_id', v_order_id, 'threshold', 5),
    'inventory_shortage',
    '/marketing',
    false,
    v_now
  from public.products prod
  join (
    select item.product_id, sum(item.quantity) as total_quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
    group by item.product_id
  ) as totals on totals.product_id = prod.id
  join public.profiles p on p.role in ('General Manager', 'MD-Marketing')
  where (prod.stock_quantity - totals.total_quantity) <= 5;

  return v_order_id;
exception when others then
  raise;
end;
$$;

alter table public.bills enable row level security;
alter table public.bill_history enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customers enable row level security;

create policy bills_select_authorized on public.bills
for select to authenticated
using (
  submitted_by = auth.uid()
  or approved_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'General Manager')
  )
);

create policy bills_insert_owner on public.bills
for insert to authenticated
with check (submitted_by = auth.uid());

create policy bills_update_authorized on public.bills
for update to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'General Manager')
  )
)
with check (true);

create policy bill_history_select_authorized on public.bill_history
for select to authenticated
using (
  exists (
    select 1 from public.bills b
    where b.id = bill_history.bill_id
      and (
        b.submitted_by = auth.uid()
        or b.approved_by = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('Vice Chairman', 'Vice President', 'General Manager')
        )
      )
  )
);

create policy bill_history_insert_authorized on public.bill_history
for insert to authenticated
with check (performed_by = auth.uid());

create policy orders_select_authorized on public.orders
for select to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'General Manager')
  )
);

create policy orders_insert_owner on public.orders
for insert to authenticated
with check (created_by = auth.uid());

create policy order_items_select_authorized on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.created_by = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'General Manager')
        )
      )
  )
);

create policy order_items_insert_authorized on public.order_items
for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.created_by = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'General Manager')
        )
      )
  )
);

create policy orders_update_authorized on public.orders
for update to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Vice Chairman', 'Vice President', 'MD-Marketing', 'General Manager')
  )
)
with check (true);

create policy customers_select_authorized on public.customers
for select to authenticated
using (true);

create policy customers_insert_authorized on public.customers
for insert to authenticated
with check (true);

create policy bill_attachment_upload_owner on storage.objects
for insert to authenticated
with check (bucket_id = 'bill-attachments' and owner_id = auth.uid()::text);

create policy bill_attachment_read_authorized on storage.objects
for select to authenticated
using (
  bucket_id = 'bill-attachments'
  and exists (
    select 1 from public.bills b
    where b.attachment_url like '%' || storage.objects.name || '%'
      and (
        b.submitted_by = auth.uid()
        or b.approved_by = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('Vice Chairman', 'Vice President', 'General Manager')
        )
      )
  )
);

grant execute on function public.create_order_with_items(text, uuid, date, date, text, numeric, jsonb) to authenticated;

create or replace function public.create_delivery_with_assignment(
  p_order_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_dispatch_date date,
  p_expected_delivery_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
begin
  insert into public.deliveries (
    order_id, vehicle_id, driver_id, assigned_by, dispatch_date,
    expected_delivery_date, status, created_at
  ) values (
    p_order_id, p_vehicle_id, p_driver_id, auth.uid(), p_dispatch_date,
    p_expected_delivery_date, 'Created', now()
  ) returning id into v_delivery_id;

  insert into public.delivery_assignments (
    delivery_id, vehicle_id, driver_id, assigned_at
  ) values (
    v_delivery_id, p_vehicle_id, p_driver_id, now()
  );

  insert into public.delivery_tracking (
    delivery_id, status, location, remarks, updated_by, updated_at
  ) values (
    v_delivery_id, 'Created', null, 'Delivery created', auth.uid(), now()
  );

  update public.orders
  set status = 'Dispatched'
  where id = p_order_id;

  return v_delivery_id;
end;
$$;

grant execute on function public.create_delivery_with_assignment(uuid, uuid, uuid, date, date) to authenticated;

alter table public.deliveries enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.notifications enable row level security;

create policy deliveries_select_transport on public.deliveries
for select to authenticated using (true);

create policy deliveries_update_transport on public.deliveries
for update to authenticated
using (
  driver_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('Vice Chairman', 'Vice President', 'General Manager')
        or (p.role = 'MD-Transport' and p.department = 'Transport'))
  )
)
with check (true);

create policy deliveries_insert_transport on public.deliveries
for insert to authenticated with check (true);

create policy delivery_tracking_select_transport on public.delivery_tracking
for select to authenticated using (true);

create policy delivery_tracking_insert_transport on public.delivery_tracking
for insert to authenticated with check (updated_by = auth.uid());

create policy notifications_select_owner on public.notifications
for select to authenticated using (user_id = auth.uid());

create policy notifications_insert_transport on public.notifications
for insert to authenticated with check (true);

-- Ensure customers have phone and email columns for OTP/SMS and contact
alter table if exists public.customers
add column if not exists phone text;

alter table if exists public.customers
add column if not exists email text;

-- Deliveries: OTP fields and confirmation timestamps
alter table if exists public.deliveries
add column if not exists delivery_otp text;

alter table if exists public.deliveries
add column if not exists otp_sent_at timestamptz;

alter table if exists public.deliveries
add column if not exists otp_expires_at timestamptz;

alter table if exists public.deliveries
add column if not exists customer_confirmed boolean default false;

alter table if exists public.deliveries
add column if not exists customer_confirmed_at timestamptz;

alter table if exists public.deliveries
add column if not exists delivered_at timestamptz;

-- Notifications: add action_url to support direct navigation from notifications
alter table if exists public.notifications
add column if not exists action_url text;

alter table if exists public.bills
add column if not exists approval_cancelled_by uuid;

alter table if exists public.bills
add column if not exists approval_cancelled_at timestamptz;

alter table if exists public.bills
add column if not exists approval_cancelled_reason text;

alter table if exists public.bills
add column if not exists returned_by uuid;

alter table if exists public.bills
add column if not exists returned_at timestamptz;

alter table if exists public.bills
add column if not exists return_reason text;

alter table if exists public.bills
add column if not exists rejected_by uuid;

alter table if exists public.bills
add column if not exists rejected_at timestamptz;

alter table if exists public.bills
add column if not exists rejection_reason text;
