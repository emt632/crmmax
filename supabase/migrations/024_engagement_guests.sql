-- Add guests JSONB column for tracking external attendees at lobby team meetings
-- Stores array of {name, organization} objects
ALTER TABLE ga_engagements ADD COLUMN IF NOT EXISTS guests JSONB DEFAULT '[]';
