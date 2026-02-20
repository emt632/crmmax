-- Migration 009: RBAC with manager hierarchy and follow-up assignment
--
-- Adds: reports_to on users, assigned_to on touchpoints,
--        recursive subordinate functions, updated RLS policies,
--        circular reference prevention trigger.

-- ============================================================
-- 1. Schema changes
-- ============================================================

-- Manager hierarchy column on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_reports_to ON public.users(reports_to);

-- Follow-up assignment column on touchpoints
ALTER TABLE public.touchpoints
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_touchpoints_assigned_to
  ON public.touchpoints(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_touchpoints_created_by
  ON public.touchpoints(created_by);

-- ============================================================
-- 2. Recursive subordinate lookup function
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_subordinate_ids(manager_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT id FROM public.users
    WHERE reports_to = manager_uuid AND is_active = TRUE

    UNION ALL

    -- Indirect reports (reports of reports)
    SELECT u.id FROM public.users u
    INNER JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = TRUE
  )
  SELECT id FROM subordinates;
$$;

-- ============================================================
-- 3. Visibility helper: can current user see target user's data?
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_see_user_data(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin sees everything
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- User sees own data
  IF auth.uid() = target_user_id THEN
    RETURN TRUE;
  END IF;

  -- Manager sees subordinate data
  IF target_user_id IN (SELECT public.get_subordinate_ids(auth.uid())) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- 4. Circular reference prevention trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_circular_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_id UUID := NEW.reports_to;
BEGIN
  IF NEW.reports_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walk up the chain; if we find NEW.id, it's a cycle
  WHILE current_id IS NOT NULL LOOP
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reporting chain detected';
    END IF;
    SELECT reports_to INTO current_id FROM public.users WHERE id = current_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_circular_reports
  BEFORE INSERT OR UPDATE OF reports_to ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_circular_reports();

-- ============================================================
-- 5. Updated RLS policies — touchpoints
-- ============================================================

DROP POLICY IF EXISTS "Users can view own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can insert own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can update own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can delete own touchpoints" ON public.touchpoints;

-- SELECT: own + assigned to me + subordinates' + admin
CREATE POLICY "Users can view visible touchpoints" ON public.touchpoints
  FOR SELECT USING (
    public.can_see_user_data(created_by)
    OR assigned_to = auth.uid()
  );

-- INSERT: only as yourself
CREATE POLICY "Users can insert touchpoints" ON public.touchpoints
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- UPDATE: creator, assignee, manager of creator, or admin
CREATE POLICY "Users can update visible touchpoints" ON public.touchpoints
  FOR UPDATE USING (
    public.can_see_user_data(created_by)
    OR assigned_to = auth.uid()
  );

-- DELETE: only creator or admin
CREATE POLICY "Users can delete own touchpoints" ON public.touchpoints
  FOR DELETE USING (
    created_by = auth.uid() OR public.is_admin()
  );

-- ============================================================
-- 6. Updated RLS policies — junction tables
-- ============================================================

-- touchpoint_contacts
DROP POLICY IF EXISTS "Users can view touchpoint_contacts they created" ON public.touchpoint_contacts;
DROP POLICY IF EXISTS "Users can insert touchpoint_contacts" ON public.touchpoint_contacts;
DROP POLICY IF EXISTS "Users can delete touchpoint_contacts they created" ON public.touchpoint_contacts;

CREATE POLICY "Users can view touchpoint_contacts" ON public.touchpoint_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.touchpoints t
      WHERE t.id = touchpoint_id
      AND (public.can_see_user_data(t.created_by) OR t.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Users can insert touchpoint_contacts" ON public.touchpoint_contacts
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete touchpoint_contacts" ON public.touchpoint_contacts
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());

-- touchpoint_organizations
DROP POLICY IF EXISTS "Users can view touchpoint_organizations they created" ON public.touchpoint_organizations;
DROP POLICY IF EXISTS "Users can insert touchpoint_organizations" ON public.touchpoint_organizations;
DROP POLICY IF EXISTS "Users can delete touchpoint_organizations they created" ON public.touchpoint_organizations;

CREATE POLICY "Users can view touchpoint_organizations" ON public.touchpoint_organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.touchpoints t
      WHERE t.id = touchpoint_id
      AND (public.can_see_user_data(t.created_by) OR t.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Users can insert touchpoint_organizations" ON public.touchpoint_organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete touchpoint_organizations" ON public.touchpoint_organizations
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());

-- ============================================================
-- 7. Updated RLS — users table (managers see their reports)
-- ============================================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.users;

CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
    OR id IN (SELECT public.get_subordinate_ids(auth.uid()))
  );
