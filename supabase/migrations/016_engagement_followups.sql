-- Migration 016: Add follow-up fields to ga_engagements
-- These support the follow-up tracking section in the engagement form

ALTER TABLE ga_engagements
  ADD COLUMN IF NOT EXISTS follow_up_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS follow_up_notes text,
  ADD COLUMN IF NOT EXISTS follow_up_completed boolean DEFAULT false;
