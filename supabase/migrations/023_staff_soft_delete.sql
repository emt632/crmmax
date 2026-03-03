-- Migration 023: Add soft-delete to legislative_office_staff
-- Historical engagement references must survive staff deactivation/removal
ALTER TABLE legislative_office_staff
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_leg_office_staff_active
  ON legislative_office_staff(is_active) WHERE is_active = true;
