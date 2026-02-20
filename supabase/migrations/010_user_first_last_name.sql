-- Migration 010: Split users.full_name into first_name + last_name
--
-- Adds first_name and last_name columns, migrates existing full_name data,
-- then replaces full_name with a trigger-computed column so existing
-- Supabase joins on full_name continue to work.

-- ============================================================
-- 1. Add new columns
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- ============================================================
-- 2. Migrate existing full_name data
-- ============================================================

UPDATE public.users
SET
  first_name = CASE
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      SPLIT_PART(full_name, ' ', 1)
    ELSE NULL
  END,
  last_name = CASE
    WHEN full_name IS NOT NULL AND full_name != '' AND POSITION(' ' IN full_name) > 0 THEN
      SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND full_name != '';

-- ============================================================
-- 3. Create trigger to auto-compute full_name from first/last
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_user_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.full_name := NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compute_full_name ON public.users;
CREATE TRIGGER compute_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.compute_user_full_name();
