-- Migration 018: Legislative directory — offices, staff, and engagement junction tables
-- Safe to re-run: uses IF NOT EXISTS for tables/indexes, DROP IF EXISTS for policies/triggers

-- ─── Legislative Offices ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislative_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_type TEXT NOT NULL CHECK (office_type IN ('legislator', 'committee')),
  name TEXT NOT NULL,
  state TEXT,
  chamber TEXT,
  district TEXT,
  legislator_people_id INTEGER REFERENCES public.legiscan_legislators(people_id),
  address TEXT,
  city TEXT,
  office_state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Legislative Office Staff ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislative_office_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.legislative_offices(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Engagement <-> Legislators junction ─────────────────────
CREATE TABLE IF NOT EXISTS public.ga_engagement_legislators (
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  people_id INTEGER NOT NULL REFERENCES public.legiscan_legislators(people_id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (engagement_id, people_id)
);

-- ─── Engagement <-> Legislative Staff junction ───────────────
CREATE TABLE IF NOT EXISTS public.ga_engagement_leg_staff (
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.legislative_office_staff(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (engagement_id, staff_id)
);

-- Drop overly restrictive chamber CHECK constraint if it exists
DO $$ BEGIN
  ALTER TABLE public.legislative_offices DROP CONSTRAINT IF EXISTS legislative_offices_chamber_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_legislative_offices_type ON public.legislative_offices(office_type);
CREATE INDEX IF NOT EXISTS idx_legislative_offices_state ON public.legislative_offices(state);
CREATE INDEX IF NOT EXISTS idx_legislative_offices_legislator ON public.legislative_offices(legislator_people_id);
CREATE INDEX IF NOT EXISTS idx_legislative_office_staff_office ON public.legislative_office_staff(office_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_legislators_engagement ON public.ga_engagement_legislators(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_legislators_people ON public.ga_engagement_legislators(people_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_leg_staff_engagement ON public.ga_engagement_leg_staff(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_leg_staff_staff ON public.ga_engagement_leg_staff(staff_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.legislative_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislative_office_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_engagement_legislators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_engagement_leg_staff ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this is safe to re-run
DROP POLICY IF EXISTS "legislative_offices_select" ON public.legislative_offices;
DROP POLICY IF EXISTS "legislative_offices_insert" ON public.legislative_offices;
DROP POLICY IF EXISTS "legislative_offices_update" ON public.legislative_offices;
DROP POLICY IF EXISTS "legislative_offices_delete" ON public.legislative_offices;
DROP POLICY IF EXISTS "legislative_office_staff_select" ON public.legislative_office_staff;
DROP POLICY IF EXISTS "legislative_office_staff_insert" ON public.legislative_office_staff;
DROP POLICY IF EXISTS "legislative_office_staff_update" ON public.legislative_office_staff;
DROP POLICY IF EXISTS "legislative_office_staff_delete" ON public.legislative_office_staff;
DROP POLICY IF EXISTS "ga_engagement_legislators_select" ON public.ga_engagement_legislators;
DROP POLICY IF EXISTS "ga_engagement_legislators_insert" ON public.ga_engagement_legislators;
DROP POLICY IF EXISTS "ga_engagement_legislators_delete" ON public.ga_engagement_legislators;
DROP POLICY IF EXISTS "ga_engagement_leg_staff_select" ON public.ga_engagement_leg_staff;
DROP POLICY IF EXISTS "ga_engagement_leg_staff_insert" ON public.ga_engagement_leg_staff;
DROP POLICY IF EXISTS "ga_engagement_leg_staff_delete" ON public.ga_engagement_leg_staff;

-- legislative_offices policies
CREATE POLICY "legislative_offices_select" ON public.legislative_offices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legislative_offices_insert" ON public.legislative_offices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "legislative_offices_update" ON public.legislative_offices
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "legislative_offices_delete" ON public.legislative_offices
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- legislative_office_staff policies
CREATE POLICY "legislative_office_staff_select" ON public.legislative_office_staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legislative_office_staff_insert" ON public.legislative_office_staff
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "legislative_office_staff_update" ON public.legislative_office_staff
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "legislative_office_staff_delete" ON public.legislative_office_staff
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ga_engagement_legislators policies
CREATE POLICY "ga_engagement_legislators_select" ON public.ga_engagement_legislators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagement_legislators_insert" ON public.ga_engagement_legislators
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagement_legislators_delete" ON public.ga_engagement_legislators
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ga_engagement_leg_staff policies
CREATE POLICY "ga_engagement_leg_staff_select" ON public.ga_engagement_leg_staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagement_leg_staff_insert" ON public.ga_engagement_leg_staff
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagement_leg_staff_delete" ON public.ga_engagement_leg_staff
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Updated_at triggers ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_legislative_offices_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legislative_offices_updated_at ON public.legislative_offices;
CREATE TRIGGER legislative_offices_updated_at
  BEFORE UPDATE ON public.legislative_offices
  FOR EACH ROW EXECUTE FUNCTION update_legislative_offices_updated_at();

CREATE OR REPLACE FUNCTION update_legislative_office_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legislative_office_staff_updated_at ON public.legislative_office_staff;
CREATE TRIGGER legislative_office_staff_updated_at
  BEFORE UPDATE ON public.legislative_office_staff
  FOR EACH ROW EXECUTE FUNCTION update_legislative_office_staff_updated_at();
