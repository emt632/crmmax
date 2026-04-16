-- ============================================================================
-- 030_philanthropy_enhancements.sql
-- Optional shifts for volunteers, team org sponsor, registration badges
-- ============================================================================

-- ── Allow direct role assignment (shift_id becomes optional) ────────────────

ALTER TABLE public.phil_volunteer_assignments
  ALTER COLUMN shift_id DROP NOT NULL;

ALTER TABLE public.phil_volunteer_assignments
  ADD COLUMN role_id UUID REFERENCES public.phil_volunteer_roles(id) ON DELETE CASCADE;

CREATE INDEX idx_phil_vol_assign_role ON public.phil_volunteer_assignments(role_id) WHERE role_id IS NOT NULL;

-- Drop the existing unique constraint on (shift_id, contact_id) since shift_id can be null now
ALTER TABLE public.phil_volunteer_assignments
  DROP CONSTRAINT IF EXISTS phil_volunteer_assignments_shift_id_contact_id_key;

-- Add a broader unique constraint: one contact per shift OR per role (direct)
CREATE UNIQUE INDEX idx_phil_vol_assign_shift_contact ON public.phil_volunteer_assignments(shift_id, contact_id) WHERE shift_id IS NOT NULL;
CREATE UNIQUE INDEX idx_phil_vol_assign_role_contact ON public.phil_volunteer_assignments(role_id, contact_id) WHERE role_id IS NOT NULL AND shift_id IS NULL;

-- ── Team sponsoring organization ───────────────────────────────────────────

ALTER TABLE public.phil_teams
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ── Registration badges (sponsor / VIP flags) ─────────────────────────────

ALTER TABLE public.phil_registrations
  ADD COLUMN is_sponsor BOOLEAN DEFAULT false,
  ADD COLUMN is_vip BOOLEAN DEFAULT false;
