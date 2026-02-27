-- Migration 014: AdvoLink bills, settings, and legislator cache tables

-- AdvoLink settings (key-value store for admin configuration)
CREATE TABLE IF NOT EXISTS public.advolink_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Bill groups (companion bill grouping)
CREATE TABLE IF NOT EXISTS public.bill_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'introduced'
    CHECK (status IN ('introduced', 'in_committee', 'passed_house', 'passed_senate', 'enrolled', 'signed', 'vetoed', 'failed')),
  jurisdiction TEXT NOT NULL DEFAULT 'US',
  session_id INTEGER,
  author TEXT,
  committees JSONB DEFAULT '[]'::jsonb,
  cosponsors JSONB DEFAULT '[]'::jsonb,
  bill_group_id UUID REFERENCES public.bill_groups(id) ON DELETE SET NULL,
  legiscan_bill_id INTEGER,
  legiscan_raw JSONB,
  is_priority BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- LegiScan legislator cache
CREATE TABLE IF NOT EXISTS public.legiscan_legislators (
  people_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  party TEXT,
  state TEXT,
  chamber TEXT,
  district TEXT,
  committee_ids JSONB DEFAULT '[]'::jsonb,
  legiscan_raw JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- LegiScan session cache
CREATE TABLE IF NOT EXISTS public.legiscan_sessions (
  session_id INTEGER PRIMARY KEY,
  jurisdiction TEXT NOT NULL,
  name TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  legiscan_raw JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_jurisdiction ON public.bills(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_bills_is_priority ON public.bills(is_priority);
CREATE INDEX IF NOT EXISTS idx_bills_bill_group_id ON public.bills(bill_group_id);
CREATE INDEX IF NOT EXISTS idx_bills_legiscan_bill_id ON public.bills(legiscan_bill_id);
CREATE INDEX IF NOT EXISTS idx_legiscan_legislators_state ON public.legiscan_legislators(state);

-- RLS
ALTER TABLE public.advolink_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legiscan_legislators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legiscan_sessions ENABLE ROW LEVEL SECURITY;

-- AdvoLink settings: readable by authenticated, writable by admin
CREATE POLICY "advolink_settings_select" ON public.advolink_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "advolink_settings_all" ON public.advolink_settings
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Bill groups: readable by authenticated, writable by creator or admin
CREATE POLICY "bill_groups_select" ON public.bill_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bill_groups_insert" ON public.bill_groups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "bill_groups_update" ON public.bill_groups
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Bills: readable by authenticated, writable by creator or admin
CREATE POLICY "bills_select" ON public.bills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bills_insert" ON public.bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "bills_update" ON public.bills
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "bills_delete" ON public.bills
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Legislator cache: readable by all authenticated, writable by all authenticated (cache)
CREATE POLICY "legiscan_legislators_select" ON public.legiscan_legislators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legiscan_legislators_all" ON public.legiscan_legislators
  FOR ALL TO authenticated USING (true);

-- Session cache: readable by all authenticated, writable by all authenticated (cache)
CREATE POLICY "legiscan_sessions_select" ON public.legiscan_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legiscan_sessions_all" ON public.legiscan_sessions
  FOR ALL TO authenticated USING (true);

-- Updated_at trigger for bills
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION update_bills_updated_at();
