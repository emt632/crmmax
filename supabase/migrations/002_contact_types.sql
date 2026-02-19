-- Migration: Contact Types system
-- Adds user-defined contact types with polymorphic assignment to contacts and organizations

-- Create contact_types table
CREATE TABLE public.contact_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create polymorphic junction table for type assignments
CREATE TABLE public.contact_type_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_type_id UUID NOT NULL REFERENCES public.contact_types(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'organization')),
    entity_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(contact_type_id, entity_type, entity_id)
);

-- Create touchpoints table
CREATE TABLE public.touchpoints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('phone', 'email', 'in-person', 'virtual', 'other')),
    date TIMESTAMPTZ NOT NULL,
    duration INTEGER,
    subject TEXT NOT NULL,
    notes TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,
    follow_up_completed BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT touchpoints_entity_check CHECK (
        contact_id IS NOT NULL OR organization_id IS NOT NULL
    )
);

-- Indexes for contact_types
CREATE INDEX idx_contact_types_sort ON public.contact_types(sort_order);

-- Indexes for contact_type_assignments
CREATE INDEX idx_cta_entity ON public.contact_type_assignments(entity_type, entity_id);
CREATE INDEX idx_cta_type ON public.contact_type_assignments(contact_type_id);

-- Indexes for touchpoints
CREATE INDEX idx_touchpoints_contact ON public.touchpoints(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_touchpoints_org ON public.touchpoints(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_touchpoints_date ON public.touchpoints(date DESC);
CREATE INDEX idx_touchpoints_type ON public.touchpoints(type);
CREATE INDEX idx_touchpoints_follow_up ON public.touchpoints(follow_up_date) WHERE follow_up_required = TRUE AND follow_up_completed = FALSE;

-- Updated_at triggers
CREATE TRIGGER update_contact_types_updated_at BEFORE UPDATE ON public.contact_types
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_touchpoints_updated_at BEFORE UPDATE ON public.touchpoints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.contact_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_type_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.touchpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_types (all authenticated users can view, creators can manage)
CREATE POLICY "Authenticated users can view contact types" ON public.contact_types
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert contact types" ON public.contact_types
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own contact types" ON public.contact_types
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own contact types" ON public.contact_types
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for contact_type_assignments
CREATE POLICY "Authenticated users can view type assignments" ON public.contact_type_assignments
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert type assignments" ON public.contact_type_assignments
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete type assignments" ON public.contact_type_assignments
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for touchpoints
CREATE POLICY "Users can view own touchpoints" ON public.touchpoints
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own touchpoints" ON public.touchpoints
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own touchpoints" ON public.touchpoints
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own touchpoints" ON public.touchpoints
    FOR DELETE USING (auth.uid() = created_by);

-- Seed default contact types
INSERT INTO public.contact_types (name, color, sort_order, created_by) VALUES
    ('EMS', '#EF4444', 1, (SELECT id FROM public.users LIMIT 1)),
    ('Fire', '#F97316', 2, (SELECT id FROM public.users LIMIT 1)),
    ('Hospital', '#3B82F6', 3, (SELECT id FROM public.users LIMIT 1)),
    ('Association', '#8B5CF6', 4, (SELECT id FROM public.users LIMIT 1)),
    ('Government', '#6B7280', 5, (SELECT id FROM public.users LIMIT 1)),
    ('Education', '#10B981', 6, (SELECT id FROM public.users LIMIT 1)),
    ('Vendor', '#F59E0B', 7, (SELECT id FROM public.users LIMIT 1)),
    ('Other', '#9CA3AF', 8, (SELECT id FROM public.users LIMIT 1));

-- Comments
COMMENT ON TABLE public.contact_types IS 'User-defined contact type categories (EMS, Fire, Hospital, etc.)';
COMMENT ON TABLE public.contact_type_assignments IS 'Polymorphic junction table linking contact types to contacts or organizations';
COMMENT ON TABLE public.touchpoints IS 'Interaction records (calls, emails, meetings) with contacts and organizations';
