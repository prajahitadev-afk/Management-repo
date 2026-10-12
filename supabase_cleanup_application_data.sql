-- Run in the Supabase SQL Editor only after confirming this is the intended project.
-- Removes public application/business rows and bill attachments while preserving
-- auth.users and user/account/reference tables listed below.
BEGIN;

CREATE TEMP TABLE _application_data_tables (
  table_oid OID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _application_data_tables (table_oid)
SELECT table_row.oid
FROM pg_class AS table_row
JOIN pg_namespace AS table_schema ON table_schema.oid = table_row.relnamespace
WHERE table_schema.nspname = 'public'
  AND table_row.relkind IN ('r', 'p')
  AND NOT table_row.relispartition
  AND table_row.relname NOT IN (
    'profiles',
    'employees',
    'employee_profiles',
    'roles',
    'user_roles',
    'user_permissions',
    'permissions',
    'role_permissions',
    'departments',
    'department_roles',
    'designations',
    'organization_settings',
    'app_settings'
  );

DO $$
DECLARE
  table_to_clear OID;
BEGIN
  LOOP
    SELECT candidate.table_oid
    INTO table_to_clear
    FROM _application_data_tables AS candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS foreign_key
      JOIN _application_data_tables AS dependent
        ON dependent.table_oid = foreign_key.conrelid
      WHERE foreign_key.contype = 'f'
        AND foreign_key.confrelid = candidate.table_oid
        AND foreign_key.conrelid <> candidate.table_oid
    )
    LIMIT 1;

    EXIT WHEN table_to_clear IS NULL;

    EXECUTE format('DELETE FROM %s', table_to_clear::regclass);
    DELETE FROM _application_data_tables WHERE table_oid = table_to_clear;
  END LOOP;

  IF EXISTS (SELECT 1 FROM _application_data_tables) THEN
    RAISE EXCEPTION 'Application tables have circular foreign keys; no cleanup was committed.';
  END IF;
END $$;

DELETE FROM storage.objects
WHERE bucket_id = 'bill-attachments';

COMMIT;