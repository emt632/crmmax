-- Migration 022: Add meeting location fields to ga_engagements
ALTER TABLE ga_engagements
  ADD COLUMN IF NOT EXISTS meeting_location TEXT,         -- 'virtual', 'in_person', 'other'
  ADD COLUMN IF NOT EXISTS meeting_location_detail TEXT;  -- free-text location name
