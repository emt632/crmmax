-- Life Link III CRM Database Schema
-- Following build rules from claude_build_rules.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM (
  'Executive Leader',
  'Partner Engagement Manager',
  'Clinical Manager',
  'Base Lead',
  'Philanthropy',
  'Advocacy',
  'Maintenance',
  'Supervisor',
  'Marketing',
  'General'
);

-- Touchpoint types
CREATE TYPE touchpoint_type AS ENUM (
  'phone',
  'email',
  'in-person',
  'virtual',
  'other'
);

-- Address types
CREATE TYPE address_type AS ENUM (
  'home',
  'work',
  'other'
);

-- PR Request status
CREATE TYPE pr_status AS ENUM (
  'pending',
  'approved',
  'declined',
  'completed',
  'cancelled'
);

-- PR Fulfillment status
CREATE TYPE pr_fulfillment AS ENUM (
  'unfulfilled',
  'partially-fulfilled',
  'fulfilled'
);

-- Ride-along attendance
CREATE TYPE attendance_type AS ENUM (
  'present',
  'absent',
  'partial'
);

-- Hiring interest
CREATE TYPE hiring_interest AS ENUM (
  'interested',
  'not-interested',
  'maybe',
  'not-applicable'
);

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'General',
  permissions JSONB DEFAULT '{"modules": {"crm": false, "philanthropy": false, "advoLink": false}, "features": {}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT,
  is_service_using BOOLEAN DEFAULT false, -- Per build rules
  main_phone TEXT,
  main_email TEXT,
  website TEXT,
  address JSONB,
  primary_contact_id UUID,
  logged_by UUID NOT NULL REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  title TEXT,
  
  -- Multiple contact methods per build rules
  emails JSONB DEFAULT '{"personal": null, "work": null}',
  phones JSONB DEFAULT '{"mobile": null, "office": null, "home": null}',
  addresses JSONB DEFAULT '[]',
  
  -- Organization relationships
  organization_affiliations JSONB DEFAULT '[]',
  
  -- Tracking per build rules
  logged_by UUID NOT NULL REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  
  -- Additional fields
  notes TEXT,
  tags TEXT[],
  last_contacted_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

-- Touchpoints table
CREATE TABLE public.touchpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_name TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  organization_name TEXT,
  
  type touchpoint_type NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- in minutes
  subject TEXT NOT NULL,
  notes TEXT,
  
  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMPTZ,
  follow_up_notes TEXT,
  
  -- Tracking per build rules
  logged_by UUID NOT NULL REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ride-alongs table
CREATE TABLE public.ride_alongs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_name TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  organization_id UUID REFERENCES public.organizations(id),
  organization_name TEXT,
  
  date DATE NOT NULL,
  base_location TEXT NOT NULL,
  
  -- Tracking per build rules
  attendance attendance_type NOT NULL,
  number_of_flights INTEGER DEFAULT 0,
  eligible_for_future BOOLEAN DEFAULT true,
  potential_hiring_status hiring_interest,
  
  -- Optional rubric upload
  rubric_file_url TEXT,
  rubric_uploaded_by UUID REFERENCES public.users(id),
  rubric_uploaded_at TIMESTAMPTZ,
  
  notes TEXT,
  
  -- Tracking
  logged_by UUID NOT NULL REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PR Requests table
CREATE TABLE public.pr_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  organization_name TEXT,
  contact_id UUID REFERENCES public.contacts(id),
  contact_name TEXT,
  
  -- Location details
  location JSONB NOT NULL, -- Contains venue, address, city, state, zip, lz_coordinates
  
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  expected_hours DECIMAL(4,2),
  
  aircraft_requested BOOLEAN DEFAULT false,
  aircraft_type TEXT,
  
  status pr_status DEFAULT 'pending',
  fulfillment_status pr_fulfillment DEFAULT 'unfulfilled',
  
  description TEXT,
  special_requirements TEXT,
  
  -- Tracking
  logged_by UUID NOT NULL REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_contacts_logged_by ON public.contacts(logged_by);
CREATE INDEX idx_contacts_full_name ON public.contacts(full_name);
CREATE INDEX idx_contacts_next_follow_up ON public.contacts(next_follow_up_date);
CREATE INDEX idx_organizations_name ON public.organizations(name);
CREATE INDEX idx_organizations_is_service_using ON public.organizations(is_service_using);
CREATE INDEX idx_touchpoints_contact_id ON public.touchpoints(contact_id);
CREATE INDEX idx_touchpoints_date ON public.touchpoints(date);
CREATE INDEX idx_ride_alongs_date ON public.ride_alongs(date);
CREATE INDEX idx_pr_requests_event_date ON public.pr_requests(event_date);
CREATE INDEX idx_pr_requests_status ON public.pr_requests(status);

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_alongs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Authenticated users can view all contacts (adjust based on permissions)
CREATE POLICY "Authenticated users can view contacts" ON public.contacts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create contacts
CREATE POLICY "Authenticated users can create contacts" ON public.contacts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update contacts
CREATE POLICY "Authenticated users can update contacts" ON public.contacts
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Similar policies for other tables
CREATE POLICY "Authenticated users can view organizations" ON public.organizations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage organizations" ON public.organizations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view touchpoints" ON public.touchpoints
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage touchpoints" ON public.touchpoints
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view ride_alongs" ON public.ride_alongs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage ride_alongs" ON public.ride_alongs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view pr_requests" ON public.pr_requests
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage pr_requests" ON public.pr_requests
  FOR ALL USING (auth.role() = 'authenticated');

-- Triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_touchpoints_updated_at BEFORE UPDATE ON public.touchpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_alongs_updated_at BEFORE UPDATE ON public.ride_alongs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pr_requests_updated_at BEFORE UPDATE ON public.pr_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();