-- Portal-level signup/effective date customization
-- effective_date_min: only show date options on or after this date; default = portal creation date
-- effective_date_option_count: max number of options to show (null = 6 at runtime)
ALTER TABLE public.portals
ADD COLUMN IF NOT EXISTS effective_date_min date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS effective_date_option_count integer DEFAULT 6;

-- Backfill existing portals: set min date to their creation date
UPDATE public.portals
SET effective_date_min = (created_at AT TIME ZONE 'UTC')::date
WHERE effective_date_min IS NULL;

COMMENT ON COLUMN public.portals.effective_date_min IS 'Only show effective date options on or after this date; defaults to portal creation date';
COMMENT ON COLUMN public.portals.effective_date_option_count IS 'Max number of effective date options to show (e.g. 1, 3, 6); null = 6';
