-- 028: Engagement file attachments
-- Storage bucket + metadata table for files attached to ga_engagements

-- ─── Storage Bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'engagement-attachments',
  'engagement-attachments',
  true,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload engagement attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'engagement-attachments');

CREATE POLICY "Authenticated users can update engagement attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'engagement-attachments');

CREATE POLICY "Authenticated users can delete engagement attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'engagement-attachments');

CREATE POLICY "Public can read engagement attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'engagement-attachments');

-- ─── Metadata Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ga_engagement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES ga_engagements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_engagement_attachments_engagement ON ga_engagement_attachments(engagement_id);

-- RLS
ALTER TABLE ga_engagement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attachments"
  ON ga_engagement_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Uploader can insert attachments"
  ON ga_engagement_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploader or admin can delete attachments"
  ON ga_engagement_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
