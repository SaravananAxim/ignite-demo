-- Plan display order per brand (1st, 2nd, 3rd on portal)
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill: assign 0, 1, 2... per brand by created_at
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY brand_id ORDER BY created_at, name) - 1 AS rn
  FROM public.plans
)
UPDATE public.plans p
SET display_order = ordered.rn
FROM ordered
WHERE p.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_plans_brand_display_order ON public.plans(brand_id, display_order);

COMMENT ON COLUMN public.plans.display_order IS 'Order within brand for portal (0 = first, 1 = second, ...)';
