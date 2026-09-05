-- Allow department MDs to access bills only within their own department.
-- Run after supabase_phase2_setup.sql.

drop policy if exists bills_select_authorized on public.bills;
drop policy if exists bills_update_authorized on public.bills;
drop policy if exists bill_attachment_read_authorized on storage.objects;

create policy bills_select_authorized on public.bills
for select to authenticated
using (
  submitted_by = auth.uid()
  or approved_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('Vice Chairman', 'Vice President', 'General Manager')
        or (
          p.role = 'MD-Manufacturing'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') = 'manufacturing'
        )
        or (
          p.role = 'MD-Marketing'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') = 'marketing'
        )
        or (
          p.role = 'MD-Transport'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') in ('transport', 'transportation')
        )
        or (
          p.role = 'MD-RD'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') in ('researchdevelopment', 'researchanddevelopment', 'rd', 'rnd')
        )
      )
  )
);

create policy bills_update_authorized on public.bills
for update to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('Vice Chairman', 'Vice President', 'General Manager')
        or (
          p.role = 'MD-Manufacturing'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') = 'manufacturing'
        )
        or (
          p.role = 'MD-Marketing'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') = 'marketing'
        )
        or (
          p.role = 'MD-Transport'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') in ('transport', 'transportation')
        )
        or (
          p.role = 'MD-RD'
          and regexp_replace(lower(coalesce(public.bills.department, '')), '[^a-z0-9]', '', 'g') in ('researchdevelopment', 'researchanddevelopment', 'rd', 'rnd')
        )
      )
  )
)
with check (true);

create policy bill_attachment_read_authorized on storage.objects
for select to authenticated
using (
  bucket_id = 'bill-attachments'
  and exists (
    select 1
    from public.bills b
    where b.attachment_url like '%' || storage.objects.name || '%'
      and (
        b.submitted_by = auth.uid()
        or b.approved_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and (
              p.role in ('Vice Chairman', 'Vice President', 'General Manager')
              or (
                p.role = 'MD-Manufacturing'
                and regexp_replace(lower(coalesce(b.department, '')), '[^a-z0-9]', '', 'g') = 'manufacturing'
              )
              or (
                p.role = 'MD-Marketing'
                and regexp_replace(lower(coalesce(b.department, '')), '[^a-z0-9]', '', 'g') = 'marketing'
              )
              or (
                p.role = 'MD-Transport'
                and regexp_replace(lower(coalesce(b.department, '')), '[^a-z0-9]', '', 'g') in ('transport', 'transportation')
              )
              or (
                p.role = 'MD-RD'
                and regexp_replace(lower(coalesce(b.department, '')), '[^a-z0-9]', '', 'g') in ('researchdevelopment', 'researchanddevelopment', 'rd', 'rnd')
              )
            )
        )
      )
  )
);
