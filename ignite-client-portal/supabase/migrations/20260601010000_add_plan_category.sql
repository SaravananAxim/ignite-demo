-- Categorize plans for admin reporting and plan management.
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';

ALTER TABLE public.plans
DROP CONSTRAINT IF EXISTS plans_category_check;

ALTER TABLE public.plans
ADD CONSTRAINT plans_category_check
CHECK (category IN ('Earned Media', 'Paid Media', 'AI', 'Other'));
