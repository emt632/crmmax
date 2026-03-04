-- Migration 025: Support Campaign Tracker
-- Tracks asks for letters of support, testimonials, and other advocacy
-- from stakeholders toward specific initiatives/bills.

-- ─── Support Asks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who at LL3/PSG made the ask
  requester_id UUID NOT NULL REFERENCES public.users(id),

  -- Target: polymorphic (exactly one FK or target_name for 'other')
  target_type TEXT NOT NULL CHECK (target_type IN (
    'legislator', 'contact', 'organization', 'leg_staff', 'other'
  )),
  target_legislator_people_id INTEGER REFERENCES public.legiscan_legislators(people_id),
  target_contact_id UUID REFERENCES public.contacts(id),
  target_organization_id UUID REFERENCES public.organizations(id),
  target_leg_staff_id UUID REFERENCES public.legislative_office_staff(id),
  target_name TEXT,

  -- The ask
  ask_date DATE NOT NULL,
  outreach_method TEXT NOT NULL CHECK (outreach_method IN (
    'virtual', 'in_person', 'email', 'phone', 'letter', 'other'
  )),
  initiative TEXT,
  support_type_requested TEXT NOT NULL CHECK (support_type_requested IN (
    'letter_of_support', 'testimonial', 'reach_out_on_behalf',
    'sign_on_letter', 'public_statement', 'event_attendance',
    'funding_commitment', 'other'
  )),
  ask_notes TEXT,
  engagement_id UUID REFERENCES public.ga_engagements(id) ON DELETE SET NULL,

  -- Conversion tracking
  support_status TEXT NOT NULL DEFAULT 'pending' CHECK (support_status IN (
    'pending', 'follow_up_needed', 'committed', 'received', 'declined'
  )),
  follow_up_date DATE,
  follow_up_notes TEXT,
  support_type_provided TEXT,
  support_received_date DATE,

  -- Stewardship
  thank_you_sent BOOLEAN DEFAULT false,
  thank_you_date DATE,
  thank_you_method TEXT CHECK (thank_you_method IN (
    'letter', 'email', 'phone', 'in_person', 'other'
  )),
  invited_to_event BOOLEAN DEFAULT false,
  event_invitation_details TEXT,
  stewardship_notes TEXT,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Support Ask <-> Bills junction ─────────────────────
CREATE TABLE IF NOT EXISTS public.support_ask_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_ask_id UUID NOT NULL REFERENCES public.support_asks(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(support_ask_id, bill_id)
);

-- ─── Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_asks_status ON public.support_asks(support_status);
CREATE INDEX IF NOT EXISTS idx_support_asks_initiative ON public.support_asks(initiative);
CREATE INDEX IF NOT EXISTS idx_support_asks_ask_date ON public.support_asks(ask_date);
CREATE INDEX IF NOT EXISTS idx_support_asks_requester ON public.support_asks(requester_id);
CREATE INDEX IF NOT EXISTS idx_support_asks_target_type ON public.support_asks(target_type);
CREATE INDEX IF NOT EXISTS idx_support_asks_engagement ON public.support_asks(engagement_id);
CREATE INDEX IF NOT EXISTS idx_support_ask_bills_ask ON public.support_ask_bills(support_ask_id);
CREATE INDEX IF NOT EXISTS idx_support_ask_bills_bill ON public.support_ask_bills(bill_id);

-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE public.support_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ask_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_asks_select" ON public.support_asks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_asks_insert" ON public.support_asks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "support_asks_update" ON public.support_asks
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "support_asks_delete" ON public.support_asks
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "support_ask_bills_select" ON public.support_ask_bills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_ask_bills_insert" ON public.support_ask_bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "support_ask_bills_delete" ON public.support_ask_bills
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_support_asks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_asks_updated_at
  BEFORE UPDATE ON public.support_asks
  FOR EACH ROW EXECUTE FUNCTION update_support_asks_updated_at();
