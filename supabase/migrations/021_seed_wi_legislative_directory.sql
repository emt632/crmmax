-- Migration 021: Seed WI legislative directory from existing CRM contacts
-- Creates 2 legislator offices + 2 staff members

-- 1. Senator Mary Felzkowski
INSERT INTO legislative_offices (id, office_type, name, state, chamber, district, phone, email, city, office_state, created_by, created_at, updated_at)
VALUES (
  gen_random_uuid(), 'legislator',
  'Senator Mary Felzkowski',
  'WI', 'senate', '12',
  '(715) 966-3366',
  'Sen.Felzkowski@legis.wi.gov',
  'Madison', 'WI',
  (SELECT id FROM users ORDER BY created_at LIMIT 1),
  now(), now()
);

-- 2. Senator Cory Tomczyk
INSERT INTO legislative_offices (id, office_type, name, state, chamber, district, phone, email, city, office_state, created_by, created_at, updated_at)
VALUES (
  gen_random_uuid(), 'legislator',
  'Senator Cory Tomczyk',
  'WI', 'senate', '29',
  NULL,
  'Sen.Tomczyk@legis.wi.gov',
  'Madison', 'WI',
  (SELECT id FROM users ORDER BY created_at LIMIT 1),
  now(), now()
);

-- 3. Staff: David Specht-Boardman → Felzkowski's office
INSERT INTO legislative_office_staff (id, office_id, first_name, last_name, title, email, created_by, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM legislative_offices WHERE name = 'Senator Mary Felzkowski' LIMIT 1),
  'David', 'Specht-Boardman', 'Policy Director',
  'David.Specht-Boardman@legis.wi.gov',
  (SELECT id FROM users ORDER BY created_at LIMIT 1),
  now(), now()
);

-- 4. Staff: Mitch Sands → Tomczyk's office
INSERT INTO legislative_office_staff (id, office_id, first_name, last_name, title, email, created_by, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM legislative_offices WHERE name = 'Senator Cory Tomczyk' LIMIT 1),
  'Mitch', 'Sands', 'Chief Of Staff',
  'Mitch.Sands@legis.wisconsin.gov',
  (SELECT id FROM users ORDER BY created_at LIMIT 1),
  now(), now()
);

-- ─── Remove these 4 from CRM contacts ───────────────────────────
-- Clean up junction tables first (FK constraints), then delete contacts

-- Contact type assignments
DELETE FROM contact_type_assignments
WHERE entity_type = 'contact'
  AND entity_id IN (
    SELECT id FROM contacts
    WHERE (first_name = 'Mary' AND last_name = 'Felzkowski')
       OR (first_name = 'Cory' AND last_name = 'Tomczyk')
       OR (first_name = 'Mitch' AND last_name = 'Sands')
       OR (first_name = 'David' AND last_name = 'Specht-Boardman')
  );

-- Contact-organization links
DELETE FROM contact_organizations
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE (first_name = 'Mary' AND last_name = 'Felzkowski')
     OR (first_name = 'Cory' AND last_name = 'Tomczyk')
     OR (first_name = 'Mitch' AND last_name = 'Sands')
     OR (first_name = 'David' AND last_name = 'Specht-Boardman')
);

-- Touchpoint-contact links
DELETE FROM touchpoint_contacts
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE (first_name = 'Mary' AND last_name = 'Felzkowski')
     OR (first_name = 'Cory' AND last_name = 'Tomczyk')
     OR (first_name = 'Mitch' AND last_name = 'Sands')
     OR (first_name = 'David' AND last_name = 'Specht-Boardman')
);

-- Engagement-contact links
DELETE FROM ga_engagement_contacts
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE (first_name = 'Mary' AND last_name = 'Felzkowski')
     OR (first_name = 'Cory' AND last_name = 'Tomczyk')
     OR (first_name = 'Mitch' AND last_name = 'Sands')
     OR (first_name = 'David' AND last_name = 'Specht-Boardman')
);

-- Finally, delete the contacts themselves
DELETE FROM contacts
WHERE (first_name = 'Mary' AND last_name = 'Felzkowski')
   OR (first_name = 'Cory' AND last_name = 'Tomczyk')
   OR (first_name = 'Mitch' AND last_name = 'Sands')
   OR (first_name = 'David' AND last_name = 'Specht-Boardman');
