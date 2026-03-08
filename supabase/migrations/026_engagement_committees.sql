-- 026: Add committee of jurisdiction + role fields to engagements
-- Allows tagging engagements with the committee context (e.g., why meeting with an out-of-state legislator)

ALTER TABLE public.ga_engagements
  ADD COLUMN IF NOT EXISTS committee_of_jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS committee_role TEXT;
