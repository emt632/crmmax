-- 027: @Mention system for engagement notes
-- Tracks who is REFERENCED in notes (separate from junction tables that track who was IN the meeting)

CREATE TABLE IF NOT EXISTS public.ga_engagement_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.ga_engagements(id) ON DELETE CASCADE,
  mention_type TEXT NOT NULL CHECK (mention_type IN ('legislator','leg_staff','contact','user','committee')),
  -- Polymorphic target (exactly one should be non-null)
  legislator_people_id INTEGER REFERENCES public.legiscan_legislators(people_id),
  leg_staff_id UUID REFERENCES public.legislative_office_staff(id),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  committee_office_id UUID REFERENCES public.legislative_offices(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_engagement_mentions_engagement ON public.ga_engagement_mentions(engagement_id);
CREATE INDEX idx_engagement_mentions_legislator ON public.ga_engagement_mentions(legislator_people_id);
CREATE INDEX idx_engagement_mentions_leg_staff ON public.ga_engagement_mentions(leg_staff_id);
CREATE INDEX idx_engagement_mentions_contact ON public.ga_engagement_mentions(contact_id);
CREATE INDEX idx_engagement_mentions_user ON public.ga_engagement_mentions(user_id);
CREATE INDEX idx_engagement_mentions_committee ON public.ga_engagement_mentions(committee_office_id);

ALTER TABLE public.ga_engagement_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentions_select" ON public.ga_engagement_mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "mentions_insert" ON public.ga_engagement_mentions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "mentions_delete" ON public.ga_engagement_mentions FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
