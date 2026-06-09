-- Add webhook_url column to portals table
ALTER TABLE public.portals 
ADD COLUMN webhook_url text DEFAULT NULL;

-- Add webhook_secret for signature verification (optional but recommended)
ALTER TABLE public.portals 
ADD COLUMN webhook_secret text DEFAULT NULL;

COMMENT ON COLUMN public.portals.webhook_url IS 'URL to receive webhook notifications when signups are completed';
COMMENT ON COLUMN public.portals.webhook_secret IS 'Secret key for signing webhook payloads';