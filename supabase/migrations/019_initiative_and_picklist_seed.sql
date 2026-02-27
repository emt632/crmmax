ALTER TABLE ga_engagements ADD COLUMN IF NOT EXISTS initiative TEXT;

INSERT INTO advolink_settings (key, value, updated_at, updated_by)
VALUES (
  'association_options',
  '["Association of Air Medical Services (AAMS)","Association of Critical Care Transport (ACCT)","Air Medical Operators Association (AMOA)","Medical Alley Association","Minnesota Hospital Association (MHA)","Wisconsin Hospital Association (WHA)","Wisconsin Rural Health Association","Minnesota Rural Health Association","Other"]'::jsonb,
  NOW(),
  (SELECT id FROM users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO advolink_settings (key, value, updated_at, updated_by)
VALUES (
  'initiative_options',
  '[]'::jsonb,
  NOW(),
  (SELECT id FROM users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (key) DO NOTHING;
