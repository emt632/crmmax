-- ============================================================================
-- 032_shift_slots.sql
-- Per-shift slot count for volunteer capacity tracking
-- ============================================================================

ALTER TABLE public.phil_volunteer_shifts
  ADD COLUMN IF NOT EXISTS slots_needed INTEGER NOT NULL DEFAULT 1;
