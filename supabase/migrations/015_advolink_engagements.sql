-- Migration 015: AdvoLink engagements and junction tables

-- GA Engagements
CREATE TABLE IF NOT EXISTS public.ga_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL
    CHECK (type IN ('lobby_team', 'ga_committee', 'legislator_office', 'committee_meeting', 'federal_state_entity')),
  date DATE NOT NULL,
  duration INTEGER, -- minutes
  subject TEXT NOT NULL,
  notes TEXT,
  topics_covered TEXT,
  jurisdiction TEXT,
  -- Legislator fields (for legislator_office type)
  legislator_people_id INTEGER,
  legislator_name TEXT,
  meeting_level TEXT CHECK (meeting_level IN ('member', 'staff')),
  -- Association fields (for ga_committee type)
  association_name TEXT,
  -- Entity fields (for federal_state_entity type)
  entity_name TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: engagement <-> bills
CREATE TABLE IF NOT EXISTS public.ga_engagement_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(engagement_id, bill_id)
);

-- Junction: engagement <-> users (LL3 staff attendance)
CREATE TABLE IF NOT EXISTS public.ga_engagement_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(engagement_id, user_id)
);

-- Junction: engagement <-> contacts (PSG contacts attendance)
CREATE TABLE IF NOT EXISTS public.ga_engagement_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(engagement_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ga_engagements_type ON public.ga_engagements(type);
CREATE INDEX IF NOT EXISTS idx_ga_engagements_date ON public.ga_engagements(date);
CREATE INDEX IF NOT EXISTS idx_ga_engagements_jurisdiction ON public.ga_engagements(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_bills_engagement ON public.ga_engagement_bills(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_bills_bill ON public.ga_engagement_bills(bill_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_staff_engagement ON public.ga_engagement_staff(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ga_engagement_contacts_engagement ON public.ga_engagement_contacts(engagement_id);

-- RLS
ALTER TABLE public.ga_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_engagement_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_engagement_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_engagement_contacts ENABLE ROW LEVEL SECURITY;

-- Engagements: readable by authenticated, writable by creator or admin
CREATE POLICY "ga_engagements_select" ON public.ga_engagements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagements_insert" ON public.ga_engagements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagements_update" ON public.ga_engagements
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "ga_engagements_delete" ON public.ga_engagements
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Junction tables: readable by authenticated, writable by authenticated
CREATE POLICY "ga_engagement_bills_select" ON public.ga_engagement_bills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagement_bills_insert" ON public.ga_engagement_bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagement_bills_delete" ON public.ga_engagement_bills
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ga_engagement_staff_select" ON public.ga_engagement_staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagement_staff_insert" ON public.ga_engagement_staff
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagement_staff_delete" ON public.ga_engagement_staff
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ga_engagement_contacts_select" ON public.ga_engagement_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ga_engagement_contacts_insert" ON public.ga_engagement_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ga_engagement_contacts_delete" ON public.ga_engagement_contacts
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated_at trigger for engagements
CREATE OR REPLACE FUNCTION update_ga_engagements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ga_engagements_updated_at
  BEFORE UPDATE ON public.ga_engagements
  FOR EACH ROW EXECUTE FUNCTION update_ga_engagements_updated_at();
