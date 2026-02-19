-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (for auth reference)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create campaigns table (needed for donations reference)
CREATE TABLE public.campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    goal_amount DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create contacts table
CREATE TABLE public.contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email_personal TEXT,
    email_work TEXT,
    phone_mobile TEXT,
    phone_home TEXT,
    phone_office TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    is_donor BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create organizations table
CREATE TABLE public.organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    is_donor BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create donations table
CREATE TABLE public.donations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    donor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    donor_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    donation_type TEXT NOT NULL CHECK (donation_type IN ('one-time', 'recurring', 'in-kind', 'employee-giving')),
    donation_method TEXT CHECK (donation_method IN ('cash', 'check', 'credit-card', 'ach', 'wire', 'stock', 'crypto', 'other')),
    donation_date DATE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    receipt_number TEXT,
    tax_deductible BOOLEAN DEFAULT TRUE,
    acknowledgement_sent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure at least one donor is specified
    CONSTRAINT donations_donor_check CHECK (
        donor_contact_id IS NOT NULL OR donor_organization_id IS NOT NULL
    )
);

-- Create contact_relationships table (contact to contact relationships)
CREATE TABLE public.contact_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    related_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent self-relationships and ensure unique pairs
    CONSTRAINT contact_relationships_no_self CHECK (contact_id != related_contact_id),
    UNIQUE(contact_id, related_contact_id)
);

-- Create organization_relationships table (org to org relationships)
CREATE TABLE public.organization_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    related_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent self-relationships and ensure unique pairs
    CONSTRAINT organization_relationships_no_self CHECK (organization_id != related_organization_id),
    UNIQUE(organization_id, related_organization_id)
);

-- Create contact_organizations join table (many-to-many between contacts and organizations)
CREATE TABLE public.contact_organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT,
    department TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique combination of contact and organization
    UNIQUE(contact_id, organization_id)
);

-- Create activities/interactions table
CREATE TABLE public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'event', 'note', 'task', 'other')),
    activity_date TIMESTAMPTZ NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    outcome TEXT,
    follow_up_date DATE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure at least one entity is associated
    CONSTRAINT activities_entity_check CHECK (
        contact_id IS NOT NULL OR organization_id IS NOT NULL
    )
);

-- Create pledges table (future commitments)
CREATE TABLE public.pledges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    donor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    donor_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    frequency TEXT CHECK (frequency IN ('one-time', 'monthly', 'quarterly', 'annually')),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'defaulted')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure at least one donor is specified
    CONSTRAINT pledges_donor_check CHECK (
        donor_contact_id IS NOT NULL OR donor_organization_id IS NOT NULL
    )
);

-- Create grants table
CREATE TABLE public.grants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    amount_requested DECIMAL(12,2),
    amount_awarded DECIMAL(12,2),
    application_date DATE,
    decision_date DATE,
    status TEXT DEFAULT 'researching' CHECK (status IN ('researching', 'writing', 'submitted', 'awarded', 'declined', 'withdrawn')),
    reporting_requirements TEXT,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create events table
CREATE TABLE public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ,
    location TEXT,
    capacity INTEGER,
    registration_required BOOLEAN DEFAULT FALSE,
    is_fundraising BOOLEAN DEFAULT FALSE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create event_attendees table
CREATE TABLE public.event_attendees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    registration_status TEXT DEFAULT 'registered' CHECK (registration_status IN ('registered', 'attended', 'no-show', 'cancelled')),
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    attendance_confirmed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique registration per entity per event
    UNIQUE(event_id, contact_id),
    UNIQUE(event_id, organization_id),
    
    -- Ensure at least one attendee type is specified
    CONSTRAINT event_attendees_entity_check CHECK (
        contact_id IS NOT NULL OR organization_id IS NOT NULL
    )
);

-- Create volunteer_hours table
CREATE TABLE public.volunteer_hours (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL CHECK (hours > 0),
    activity_type TEXT,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
-- Contacts indexes
CREATE INDEX idx_contacts_last_name ON public.contacts(last_name);
CREATE INDEX idx_contacts_first_name ON public.contacts(first_name);
CREATE INDEX idx_contacts_email_work ON public.contacts(email_work) WHERE email_work IS NOT NULL;
CREATE INDEX idx_contacts_email_personal ON public.contacts(email_personal) WHERE email_personal IS NOT NULL;
CREATE INDEX idx_contacts_is_donor ON public.contacts(is_donor) WHERE is_donor = TRUE;
CREATE INDEX idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX idx_contacts_full_name ON public.contacts(last_name, first_name);

-- Organizations indexes
CREATE INDEX idx_organizations_name ON public.organizations(name);
CREATE INDEX idx_organizations_type ON public.organizations(type) WHERE type IS NOT NULL;
CREATE INDEX idx_organizations_is_donor ON public.organizations(is_donor) WHERE is_donor = TRUE;
CREATE INDEX idx_organizations_created_by ON public.organizations(created_by);

-- Donations indexes
CREATE INDEX idx_donations_donor_contact ON public.donations(donor_contact_id) WHERE donor_contact_id IS NOT NULL;
CREATE INDEX idx_donations_donor_org ON public.donations(donor_organization_id) WHERE donor_organization_id IS NOT NULL;
CREATE INDEX idx_donations_campaign ON public.donations(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_donations_date ON public.donations(donation_date DESC);
CREATE INDEX idx_donations_amount ON public.donations(amount DESC);
CREATE INDEX idx_donations_type ON public.donations(donation_type);

-- Contact Organizations indexes
CREATE INDEX idx_contact_organizations_contact ON public.contact_organizations(contact_id);
CREATE INDEX idx_contact_organizations_org ON public.contact_organizations(organization_id);
CREATE INDEX idx_contact_organizations_primary ON public.contact_organizations(contact_id) WHERE is_primary = TRUE;

-- Activities indexes
CREATE INDEX idx_activities_contact ON public.activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_activities_org ON public.activities(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_activities_date ON public.activities(activity_date DESC);
CREATE INDEX idx_activities_type ON public.activities(activity_type);
CREATE INDEX idx_activities_follow_up ON public.activities(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Pledges indexes
CREATE INDEX idx_pledges_donor_contact ON public.pledges(donor_contact_id) WHERE donor_contact_id IS NOT NULL;
CREATE INDEX idx_pledges_donor_org ON public.pledges(donor_organization_id) WHERE donor_organization_id IS NOT NULL;
CREATE INDEX idx_pledges_campaign ON public.pledges(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_pledges_status ON public.pledges(status);
CREATE INDEX idx_pledges_start_date ON public.pledges(start_date);

-- Grants indexes
CREATE INDEX idx_grants_organization ON public.grants(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_grants_status ON public.grants(status);
CREATE INDEX idx_grants_decision_date ON public.grants(decision_date) WHERE decision_date IS NOT NULL;

-- Events indexes
CREATE INDEX idx_events_start ON public.events(start_datetime);
CREATE INDEX idx_events_campaign ON public.events(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_events_fundraising ON public.events(is_fundraising) WHERE is_fundraising = TRUE;

-- Event Attendees indexes
CREATE INDEX idx_event_attendees_event ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_contact ON public.event_attendees(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_event_attendees_org ON public.event_attendees(organization_id) WHERE organization_id IS NOT NULL;

-- Volunteer Hours indexes
CREATE INDEX idx_volunteer_hours_contact ON public.volunteer_hours(contact_id);
CREATE INDEX idx_volunteer_hours_date ON public.volunteer_hours(date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON public.donations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_relationships_updated_at BEFORE UPDATE ON public.contact_relationships
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_relationships_updated_at BEFORE UPDATE ON public.organization_relationships
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_organizations_updated_at BEFORE UPDATE ON public.contact_organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON public.pledges
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grants_updated_at BEFORE UPDATE ON public.grants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_attendees_updated_at BEFORE UPDATE ON public.event_attendees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_volunteer_hours_updated_at BEFORE UPDATE ON public.volunteer_hours
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for campaigns
CREATE POLICY "Users can view own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for contacts
CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own contacts" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own contacts" ON public.contacts
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for organizations
CREATE POLICY "Users can view own organizations" ON public.organizations
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own organizations" ON public.organizations
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own organizations" ON public.organizations
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for donations
CREATE POLICY "Users can view own donations" ON public.donations
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own donations" ON public.donations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own donations" ON public.donations
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own donations" ON public.donations
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for contact_relationships
CREATE POLICY "Users can view own contact relationships" ON public.contact_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.contacts 
            WHERE contacts.id = contact_relationships.contact_id 
            AND contacts.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert contact relationships" ON public.contact_relationships
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.contacts 
            WHERE contacts.id = contact_id 
            AND contacts.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update contact relationships" ON public.contact_relationships
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.contacts 
            WHERE contacts.id = contact_relationships.contact_id 
            AND contacts.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can delete contact relationships" ON public.contact_relationships
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.contacts 
            WHERE contacts.id = contact_relationships.contact_id 
            AND contacts.created_by = auth.uid()
        )
    );

-- RLS Policies for organization_relationships
CREATE POLICY "Users can view own org relationships" ON public.organization_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE organizations.id = organization_relationships.organization_id 
            AND organizations.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert org relationships" ON public.organization_relationships
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE organizations.id = organization_id 
            AND organizations.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update org relationships" ON public.organization_relationships
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE organizations.id = organization_relationships.organization_id 
            AND organizations.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can delete org relationships" ON public.organization_relationships
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE organizations.id = organization_relationships.organization_id 
            AND organizations.created_by = auth.uid()
        )
    );

-- RLS Policies for contact_organizations
CREATE POLICY "Users can view contact-org relationships" ON public.contact_organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.contacts 
            WHERE contacts.id = contact_organizations.contact_id 
            AND contacts.created_by = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE organizations.id = contact_organizations.organization_id 
            AND organizations.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert contact-org relationships" ON public.contact_organizations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update contact-org relationships" ON public.contact_organizations
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete contact-org relationships" ON public.contact_organizations
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for activities
CREATE POLICY "Users can view own activities" ON public.activities
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own activities" ON public.activities
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own activities" ON public.activities
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own activities" ON public.activities
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for pledges
CREATE POLICY "Users can view own pledges" ON public.pledges
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own pledges" ON public.pledges
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own pledges" ON public.pledges
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own pledges" ON public.pledges
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for grants
CREATE POLICY "Users can view own grants" ON public.grants
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own grants" ON public.grants
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own grants" ON public.grants
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own grants" ON public.grants
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for events
CREATE POLICY "Users can view own events" ON public.events
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own events" ON public.events
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events" ON public.events
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own events" ON public.events
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for event_attendees
CREATE POLICY "Users can view event attendees" ON public.event_attendees
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = event_attendees.event_id 
            AND events.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert event attendees" ON public.event_attendees
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update event attendees" ON public.event_attendees
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete event attendees" ON public.event_attendees
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for volunteer_hours
CREATE POLICY "Users can view volunteer hours" ON public.volunteer_hours
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert volunteer hours" ON public.volunteer_hours
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update volunteer hours" ON public.volunteer_hours
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete volunteer hours" ON public.volunteer_hours
    FOR DELETE USING (auth.uid() = created_by);

-- Add table and column comments for documentation
COMMENT ON TABLE public.users IS 'User accounts for authentication and ownership tracking';
COMMENT ON TABLE public.campaigns IS 'Fundraising campaigns and initiatives';
COMMENT ON TABLE public.contacts IS 'Individual contact records for donors, volunteers, and stakeholders';
COMMENT ON TABLE public.organizations IS 'Organization records including companies, foundations, and institutions';
COMMENT ON TABLE public.donations IS 'Financial contributions from contacts or organizations';
COMMENT ON TABLE public.contact_relationships IS 'Relationships between individual contacts (family, business associates, etc)';
COMMENT ON TABLE public.organization_relationships IS 'Relationships between organizations (parent company, subsidiary, etc)';
COMMENT ON TABLE public.contact_organizations IS 'Many-to-many relationship between contacts and organizations';
COMMENT ON TABLE public.activities IS 'Interaction history and tasks for contacts and organizations';
COMMENT ON TABLE public.pledges IS 'Future donation commitments from donors';
COMMENT ON TABLE public.grants IS 'Grant applications and awards from foundations';
COMMENT ON TABLE public.events IS 'Fundraising and engagement events';
COMMENT ON TABLE public.event_attendees IS 'Registration and attendance tracking for events';
COMMENT ON TABLE public.volunteer_hours IS 'Volunteer time tracking for contacts';

-- Column comments
COMMENT ON COLUMN public.contacts.is_donor IS 'Flag indicating if contact has made donations';
COMMENT ON COLUMN public.organizations.is_donor IS 'Flag indicating if organization has made donations';
COMMENT ON COLUMN public.donations.donation_type IS 'Type of donation: one-time, recurring, in-kind, or employee-giving';
COMMENT ON COLUMN public.donations.tax_deductible IS 'Whether donation is tax deductible';
COMMENT ON COLUMN public.donations.acknowledgement_sent IS 'Whether thank you acknowledgement has been sent';
COMMENT ON COLUMN public.contact_organizations.is_primary IS 'Primary organization affiliation for the contact';
COMMENT ON COLUMN public.pledges.status IS 'Current status of pledge commitment';
COMMENT ON COLUMN public.grants.status IS 'Current stage of grant application process';
COMMENT ON COLUMN public.events.is_fundraising IS 'Whether event is a fundraising event';
COMMENT ON COLUMN public.event_attendees.registration_status IS 'Current status of event registration';