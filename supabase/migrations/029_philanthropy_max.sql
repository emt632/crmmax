-- ============================================================================
-- 029_philanthropy_max.sql
-- PhilanthropyMax module — event management, sponsors, donations, volunteers
-- ============================================================================

-- ── phil_events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('golf_outing','gala','5k','auction','walkathon','other')),
  status      TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','open_registration','sold_out','in_progress','completed','cancelled')),
  start_date  DATE,
  end_date    DATE,
  venue_name  TEXT,
  venue_address TEXT,
  venue_city  TEXT,
  venue_state TEXT,
  venue_zip   TEXT,
  budget_amount  NUMERIC(12,2),
  goal_amount    NUMERIC(12,2),
  capacity    INTEGER,
  description TEXT,
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_events_select" ON public.phil_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_events_insert" ON public.phil_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_events_update" ON public.phil_events FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_events_delete" ON public.phil_events FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_events_status ON public.phil_events(status);
CREATE INDEX idx_phil_events_start_date ON public.phil_events(start_date DESC);
CREATE INDEX idx_phil_events_created_by ON public.phil_events(created_by);

CREATE TRIGGER update_phil_events_updated_at BEFORE UPDATE ON public.phil_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_sponsor_tiers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_sponsor_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  benefits    JSONB DEFAULT '[]'::jsonb,
  max_sponsors INTEGER,
  created_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_sponsor_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_sponsor_tiers_select" ON public.phil_sponsor_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_sponsor_tiers_insert" ON public.phil_sponsor_tiers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_sponsor_tiers_update" ON public.phil_sponsor_tiers FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_sponsor_tiers_delete" ON public.phil_sponsor_tiers FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_sponsor_tiers_event ON public.phil_sponsor_tiers(event_id);

CREATE TRIGGER update_phil_sponsor_tiers_updated_at BEFORE UPDATE ON public.phil_sponsor_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_sponsors ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_sponsors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  tier_id         UUID REFERENCES public.phil_sponsor_tiers(id) ON DELETE SET NULL,
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','waived')),
  payment_amount  NUMERIC(12,2) DEFAULT 0,
  hole_assignment TEXT,
  logo_received   BOOLEAN DEFAULT false,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_sponsors_select" ON public.phil_sponsors FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_sponsors_insert" ON public.phil_sponsors FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_sponsors_update" ON public.phil_sponsors FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_sponsors_delete" ON public.phil_sponsors FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_sponsors_event ON public.phil_sponsors(event_id);
CREATE INDEX idx_phil_sponsors_org ON public.phil_sponsors(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_phil_sponsors_tier ON public.phil_sponsors(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX idx_phil_sponsors_payment ON public.phil_sponsors(payment_status);

CREATE TRIGGER update_phil_sponsors_updated_at BEFORE UPDATE ON public.phil_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_registrations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  role                TEXT NOT NULL DEFAULT 'golfer' CHECK (role IN ('golfer','dinner_only','volunteer','vip','speaker')),
  registration_date   TIMESTAMPTZ DEFAULT now(),
  fee_amount          NUMERIC(12,2) DEFAULT 0,
  fee_paid            BOOLEAN DEFAULT false,
  promo_code          TEXT,
  waiver_signed       BOOLEAN DEFAULT false,
  waiver_signed_at    TIMESTAMPTZ,
  dietary_restrictions TEXT,
  shirt_size          TEXT,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_registrations_select" ON public.phil_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_registrations_insert" ON public.phil_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_registrations_update" ON public.phil_registrations FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_registrations_delete" ON public.phil_registrations FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_registrations_event ON public.phil_registrations(event_id);
CREATE INDEX idx_phil_registrations_contact ON public.phil_registrations(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_phil_registrations_role ON public.phil_registrations(role);

CREATE TRIGGER update_phil_registrations_updated_at BEFORE UPDATE ON public.phil_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_teams ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  team_name     TEXT NOT NULL,
  tee_time      TIME,
  starting_hole INTEGER CHECK (starting_hole >= 1 AND starting_hole <= 18),
  cart_number   TEXT,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_teams_select" ON public.phil_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_teams_insert" ON public.phil_teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_teams_update" ON public.phil_teams FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_teams_delete" ON public.phil_teams FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_teams_event ON public.phil_teams(event_id);

CREATE TRIGGER update_phil_teams_updated_at BEFORE UPDATE ON public.phil_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_team_members ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.phil_teams(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.phil_registrations(id) ON DELETE CASCADE,
  position        INTEGER CHECK (position >= 1 AND position <= 4),
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, registration_id)
);

ALTER TABLE public.phil_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_team_members_select" ON public.phil_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_team_members_insert" ON public.phil_team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_team_members_update" ON public.phil_team_members FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_team_members_delete" ON public.phil_team_members FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_team_members_team ON public.phil_team_members(team_id);
CREATE INDEX idx_phil_team_members_reg ON public.phil_team_members(registration_id);

-- ── phil_cash_donations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_cash_donations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  amount              NUMERIC(12,2) NOT NULL,
  donation_date       DATE DEFAULT CURRENT_DATE,
  method              TEXT DEFAULT 'check' CHECK (method IN ('cash','check','credit_card','ach','other')),
  receipt_number      TEXT,
  tax_deductible      BOOLEAN DEFAULT true,
  acknowledgement_sent BOOLEAN DEFAULT false,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_cash_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_cash_donations_select" ON public.phil_cash_donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_cash_donations_insert" ON public.phil_cash_donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_cash_donations_update" ON public.phil_cash_donations FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_cash_donations_delete" ON public.phil_cash_donations FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_cash_donations_event ON public.phil_cash_donations(event_id);
CREATE INDEX idx_phil_cash_donations_contact ON public.phil_cash_donations(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_phil_cash_donations_date ON public.phil_cash_donations(donation_date DESC);

CREATE TRIGGER update_phil_cash_donations_updated_at BEFORE UPDATE ON public.phil_cash_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_inkind_donations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_inkind_donations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  item_description    TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('goods','services','experiences','food_beverage','printing','venue','other')),
  fair_market_value   NUMERIC(12,2) DEFAULT 0,
  intended_use        TEXT,
  quantity            INTEGER DEFAULT 1,
  acknowledgement_sent BOOLEAN DEFAULT false,
  receipt_issued      BOOLEAN DEFAULT false,
  form_8283_required  BOOLEAN GENERATED ALWAYS AS (fair_market_value > 500) STORED,
  form_8283_completed BOOLEAN DEFAULT false,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_inkind_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_inkind_donations_select" ON public.phil_inkind_donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_inkind_donations_insert" ON public.phil_inkind_donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_inkind_donations_update" ON public.phil_inkind_donations FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_inkind_donations_delete" ON public.phil_inkind_donations FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_inkind_donations_event ON public.phil_inkind_donations(event_id);
CREATE INDEX idx_phil_inkind_donations_contact ON public.phil_inkind_donations(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_phil_inkind_donations_category ON public.phil_inkind_donations(category);

CREATE TRIGGER update_phil_inkind_donations_updated_at BEFORE UPDATE ON public.phil_inkind_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_volunteer_roles ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_volunteer_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  role_name   TEXT NOT NULL,
  description TEXT,
  slots_needed INTEGER DEFAULT 1,
  created_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_volunteer_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_volunteer_roles_select" ON public.phil_volunteer_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_volunteer_roles_insert" ON public.phil_volunteer_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_volunteer_roles_update" ON public.phil_volunteer_roles FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_volunteer_roles_delete" ON public.phil_volunteer_roles FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_volunteer_roles_event ON public.phil_volunteer_roles(event_id);

CREATE TRIGGER update_phil_volunteer_roles_updated_at BEFORE UPDATE ON public.phil_volunteer_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_volunteer_shifts ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_volunteer_shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES public.phil_volunteer_roles(id) ON DELETE CASCADE,
  shift_label TEXT NOT NULL,
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_volunteer_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_volunteer_shifts_select" ON public.phil_volunteer_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_volunteer_shifts_insert" ON public.phil_volunteer_shifts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_volunteer_shifts_update" ON public.phil_volunteer_shifts FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_volunteer_shifts_delete" ON public.phil_volunteer_shifts FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_volunteer_shifts_role ON public.phil_volunteer_shifts(role_id);

CREATE TRIGGER update_phil_volunteer_shifts_updated_at BEFORE UPDATE ON public.phil_volunteer_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_volunteer_assignments ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_volunteer_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES public.phil_volunteer_shifts(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  checked_in    BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  hours_logged  NUMERIC(5,2),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id, contact_id)
);

ALTER TABLE public.phil_volunteer_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_volunteer_assignments_select" ON public.phil_volunteer_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_volunteer_assignments_insert" ON public.phil_volunteer_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_volunteer_assignments_update" ON public.phil_volunteer_assignments FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_volunteer_assignments_delete" ON public.phil_volunteer_assignments FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_volunteer_assignments_shift ON public.phil_volunteer_assignments(shift_id);
CREATE INDEX idx_phil_volunteer_assignments_contact ON public.phil_volunteer_assignments(contact_id);

CREATE TRIGGER update_phil_volunteer_assignments_updated_at BEFORE UPDATE ON public.phil_volunteer_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── phil_contests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phil_contests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.phil_events(id) ON DELETE CASCADE,
  contest_type          TEXT NOT NULL CHECK (contest_type IN ('longest_drive','closest_to_pin','hole_in_one','putting','other')),
  hole_number           INTEGER CHECK (hole_number >= 1 AND hole_number <= 18),
  prize_description     TEXT,
  prize_value           NUMERIC(12,2),
  winner_registration_id UUID REFERENCES public.phil_registrations(id) ON DELETE SET NULL,
  winning_result        TEXT,
  sponsor_id            UUID REFERENCES public.phil_sponsors(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_by            UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phil_contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phil_contests_select" ON public.phil_contests FOR SELECT TO authenticated USING (true);
CREATE POLICY "phil_contests_insert" ON public.phil_contests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "phil_contests_update" ON public.phil_contests FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "phil_contests_delete" ON public.phil_contests FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_phil_contests_event ON public.phil_contests(event_id);
CREATE INDEX idx_phil_contests_type ON public.phil_contests(contest_type);

CREATE TRIGGER update_phil_contests_updated_at BEFORE UPDATE ON public.phil_contests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
