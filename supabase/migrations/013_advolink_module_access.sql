-- Migration 013: Add module_access JSONB column to users table
-- Controls per-user access to CRM, Philanthropy, and AdvoLink modules

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS module_access JSONB DEFAULT '{"crm": true, "philanthropy": false, "advoLink": false}'::jsonb;

-- Set admins to have all modules enabled
UPDATE public.users
SET module_access = '{"crm": true, "philanthropy": true, "advoLink": true}'::jsonb
WHERE role = 'admin';
