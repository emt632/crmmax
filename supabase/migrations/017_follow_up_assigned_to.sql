-- Migration 017: Add follow_up_assigned_to to ga_engagements
-- Allows assigning a specific user to handle follow-up on an engagement

ALTER TABLE ga_engagements
  ADD COLUMN IF NOT EXISTS follow_up_assigned_to uuid REFERENCES auth.users(id);
