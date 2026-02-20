-- Add photo_url column to contacts table
ALTER TABLE public.contacts ADD COLUMN photo_url TEXT;

-- Create storage bucket for contact photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-photos',
  'contact-photos',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies
CREATE POLICY "Authenticated users can upload contact photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contact-photos');

CREATE POLICY "Authenticated users can update contact photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contact-photos');

CREATE POLICY "Authenticated users can delete contact photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contact-photos');

CREATE POLICY "Anyone can view contact photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'contact-photos');
