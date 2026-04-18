-- ============================================================================
-- 033_module_access_levels.sql
-- Convert module_access from booleans to access levels (none/view/edit/admin)
-- ============================================================================

-- Migrate existing values:
--   true  -> 'edit'   (preserve existing access)
--   false -> 'none'
-- Already-string values are left untouched, so this migration is idempotent.
UPDATE public.users
SET module_access = jsonb_build_object(
  'crm',
  CASE
    WHEN (module_access->>'crm') IN ('none','view','edit','admin') THEN module_access->>'crm'
    WHEN (module_access->>'crm')::text = 'true' THEN 'edit'
    ELSE 'none'
  END,
  'philanthropy',
  CASE
    WHEN (module_access->>'philanthropy') IN ('none','view','edit','admin') THEN module_access->>'philanthropy'
    WHEN (module_access->>'philanthropy')::text = 'true' THEN 'edit'
    ELSE 'none'
  END,
  'advoLink',
  CASE
    WHEN (module_access->>'advoLink') IN ('none','view','edit','admin') THEN module_access->>'advoLink'
    WHEN (module_access->>'advoLink')::text = 'true' THEN 'edit'
    ELSE 'none'
  END
)
WHERE module_access IS NOT NULL;

-- Default for new users: edit on CRM, none elsewhere
ALTER TABLE public.users
  ALTER COLUMN module_access
  SET DEFAULT '{"crm":"edit","philanthropy":"none","advoLink":"none"}'::jsonb;
