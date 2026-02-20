-- Add CMS hospital fields to organizations table
ALTER TABLE public.organizations ADD COLUMN cms_certification_number TEXT;
ALTER TABLE public.organizations ADD COLUMN hospital_type TEXT;
ALTER TABLE public.organizations ADD COLUMN hospital_ownership TEXT;
