-- ============================================================================
-- 031_registration_checkin.sql
-- Add check-in tracking to registrations for day-of operations
-- ============================================================================

ALTER TABLE public.phil_registrations
  ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
