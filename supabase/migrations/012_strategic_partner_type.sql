-- Add "Strategic Partner" contact type
INSERT INTO public.contact_types (name, color, sort_order, created_by, created_at, updated_at)
SELECT 'Strategic Partner', '#0EA5E9',
  COALESCE((SELECT MAX(sort_order) + 1 FROM public.contact_types), 1),
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.contact_types WHERE name = 'Strategic Partner'
);
