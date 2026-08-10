-- Add brand-level existing customer logic toggle.
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS existing_customer_logic boolean NOT NULL DEFAULT false;
