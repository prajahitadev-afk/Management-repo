-- Employee profile fields used by the self-service profile editor.
-- Existing deployments created profiles before the address field was introduced.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text;

COMMIT;
