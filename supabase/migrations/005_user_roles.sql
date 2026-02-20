-- Migration: Add role-based access, user management columns

-- 1. Add columns to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'General';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Set the first user (earliest created) to admin
UPDATE public.users
SET role = 'admin'
WHERE created_at = (SELECT MIN(created_at) FROM public.users);

-- 3. Create is_admin() helper for RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
END;
$$;

-- 4. Update the auth sync trigger to include new columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, is_active, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'General', TRUE, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Update RLS policies on public.users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;

-- Users see own profile; admins see all
CREATE POLICY "Users can view profiles" ON public.users
    FOR SELECT USING (
        auth.uid() = id OR public.is_admin()
    );

-- Users update own profile; admins update any
CREATE POLICY "Users can update profiles" ON public.users
    FOR UPDATE USING (
        auth.uid() = id OR public.is_admin()
    );

-- Admins can insert users directly
CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (public.is_admin());

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

COMMENT ON COLUMN public.users.role IS 'User role: admin, Executive Leader, General, etc.';
COMMENT ON COLUMN public.users.full_name IS 'Display name for the user';
COMMENT ON COLUMN public.users.is_active IS 'Whether the user can log in';
