-- Add is_vip column to contacts table
ALTER TABLE public.contacts ADD COLUMN is_vip BOOLEAN DEFAULT FALSE;

-- Create index for VIP filtering
CREATE INDEX idx_contacts_is_vip ON public.contacts(is_vip) WHERE is_vip = TRUE;

-- Backfill: mark existing contacts with Director/Chief in title as VIP
UPDATE public.contacts SET is_vip = TRUE WHERE title ILIKE '%Director%' OR title ILIKE '%Chief%';

COMMENT ON COLUMN public.contacts.is_vip IS 'Flag indicating if contact is a VIP';
