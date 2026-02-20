-- Migration 008: Multi-contact & multi-organization touchpoints
-- Replace single contact_id/organization_id FK columns with junction tables

-- 1. Create junction tables

CREATE TABLE public.touchpoint_contacts (
    touchpoint_id UUID NOT NULL REFERENCES public.touchpoints(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (touchpoint_id, contact_id)
);

CREATE TABLE public.touchpoint_organizations (
    touchpoint_id UUID NOT NULL REFERENCES public.touchpoints(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (touchpoint_id, organization_id)
);

CREATE INDEX idx_touchpoint_contacts_tp ON public.touchpoint_contacts(touchpoint_id);
CREATE INDEX idx_touchpoint_contacts_contact ON public.touchpoint_contacts(contact_id);
CREATE INDEX idx_touchpoint_organizations_tp ON public.touchpoint_organizations(touchpoint_id);
CREATE INDEX idx_touchpoint_organizations_org ON public.touchpoint_organizations(organization_id);

-- 2. Migrate existing data into junction tables

INSERT INTO public.touchpoint_contacts (touchpoint_id, contact_id, created_by)
SELECT id, contact_id, created_by
FROM public.touchpoints
WHERE contact_id IS NOT NULL;

INSERT INTO public.touchpoint_organizations (touchpoint_id, organization_id, created_by)
SELECT id, organization_id, created_by
FROM public.touchpoints
WHERE organization_id IS NOT NULL;

-- 3. Drop the CHECK constraint

ALTER TABLE public.touchpoints DROP CONSTRAINT touchpoints_entity_check;

-- 4. Drop old indexes

DROP INDEX IF EXISTS idx_touchpoints_contact;
DROP INDEX IF EXISTS idx_touchpoints_org;

-- 5. Drop old columns

ALTER TABLE public.touchpoints DROP COLUMN contact_id;
ALTER TABLE public.touchpoints DROP COLUMN organization_id;

-- 6. Enable RLS + policies on junction tables

ALTER TABLE public.touchpoint_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.touchpoint_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view touchpoint_contacts they created"
    ON public.touchpoint_contacts FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert touchpoint_contacts"
    ON public.touchpoint_contacts FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete touchpoint_contacts they created"
    ON public.touchpoint_contacts FOR DELETE
    USING (created_by = auth.uid());

CREATE POLICY "Users can view touchpoint_organizations they created"
    ON public.touchpoint_organizations FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert touchpoint_organizations"
    ON public.touchpoint_organizations FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete touchpoint_organizations they created"
    ON public.touchpoint_organizations FOR DELETE
    USING (created_by = auth.uid());
