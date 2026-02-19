-- Migration: Auth user sync trigger + restore constraints on migration-002 tables

-- 1. Create trigger function to auto-sync auth.users → public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to auth.users (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync any existing auth users that don't have public.users rows
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT id, email, created_at, NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 4. Drop ALL existing policies on migration-002 tables (clean slate)
DROP POLICY IF EXISTS "Allow all on contact_types" ON public.contact_types;
DROP POLICY IF EXISTS "Authenticated users can view contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can insert contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can update own contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can delete own contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can view own contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can insert own contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can update contact types" ON public.contact_types;
DROP POLICY IF EXISTS "Users can delete contact types" ON public.contact_types;

DROP POLICY IF EXISTS "Allow all on contact_type_assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Authenticated users can view type assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Users can insert type assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Users can delete type assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Users can view own type assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Users can insert own type assignments" ON public.contact_type_assignments;
DROP POLICY IF EXISTS "Users can delete own type assignments" ON public.contact_type_assignments;

DROP POLICY IF EXISTS "Allow all on touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can view own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can insert own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can update own touchpoints" ON public.touchpoints;
DROP POLICY IF EXISTS "Users can delete own touchpoints" ON public.touchpoints;

-- 5. Recreate proper RLS policies for contact_types
CREATE POLICY "Authenticated users can view contact types" ON public.contact_types
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert contact types" ON public.contact_types
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own contact types" ON public.contact_types
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own contact types" ON public.contact_types
    FOR DELETE USING (auth.uid() = created_by);

-- Recreate proper RLS policies for contact_type_assignments
CREATE POLICY "Authenticated users can view type assignments" ON public.contact_type_assignments
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert type assignments" ON public.contact_type_assignments
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete type assignments" ON public.contact_type_assignments
    FOR DELETE USING (auth.uid() = created_by);

-- Recreate proper RLS policies for touchpoints
CREATE POLICY "Users can view own touchpoints" ON public.touchpoints
    FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can insert own touchpoints" ON public.touchpoints
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own touchpoints" ON public.touchpoints
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own touchpoints" ON public.touchpoints
    FOR DELETE USING (auth.uid() = created_by);

-- 6. Drop and recreate policies on base tables (contacts, organizations, contact_organizations)
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON public.contacts;

CREATE POLICY "Authenticated users can view contacts" ON public.contacts
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update contacts" ON public.contacts
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can insert own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can update own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can delete own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can delete organizations" ON public.organizations;

CREATE POLICY "Authenticated users can view organizations" ON public.organizations
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update organizations" ON public.organizations
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete organizations" ON public.organizations
    FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view contact-org relationships" ON public.contact_organizations;
DROP POLICY IF EXISTS "Users can insert contact-org relationships" ON public.contact_organizations;
DROP POLICY IF EXISTS "Users can update contact-org relationships" ON public.contact_organizations;
DROP POLICY IF EXISTS "Users can delete contact-org relationships" ON public.contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can view contact-org" ON public.contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can insert contact-org" ON public.contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can update contact-org" ON public.contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can delete contact-org" ON public.contact_organizations;

CREATE POLICY "Authenticated users can view contact-org" ON public.contact_organizations
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert contact-org" ON public.contact_organizations
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update contact-org" ON public.contact_organizations
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete contact-org" ON public.contact_organizations
    FOR DELETE USING (auth.uid() IS NOT NULL);
