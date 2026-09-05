-- Add only the employee profile fields that are not currently represented.
alter table if exists public.profiles
  add column if not exists employee_code text;

alter table if exists public.profiles
  add column if not exists designation text;

alter table if exists public.profiles
  add column if not exists hierarchy_level integer;
