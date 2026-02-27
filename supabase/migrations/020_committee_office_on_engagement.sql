-- Migration 020: Add committee_office_id to ga_engagements
-- Links a committee_meeting engagement to a specific committee office

ALTER TABLE ga_engagements
  ADD COLUMN IF NOT EXISTS committee_office_id UUID REFERENCES legislative_offices(id);
