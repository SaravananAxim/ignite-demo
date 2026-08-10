-- Add new fields to franchisees table for expanded onboarding

-- Business information
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS legal_business_name text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS legal_entity text;

-- Contact information (split phone into business and cell)
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS business_phone text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS cell_phone text;

-- Signer information
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS position_title text;

-- Location information
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS franchise_location_name text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS is_new_location boolean DEFAULT false;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS grand_opening_date date;

-- Campaign representative
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS campaign_rep_name text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS campaign_rep_email text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS campaign_rep_phone text;

-- Billing representative
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS billing_rep_name text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS billing_rep_email text;
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS billing_rep_phone text;

-- Track onboarding completion step for resume capability
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'payment';

-- Add comment to explain the onboarding_step values
COMMENT ON COLUMN public.franchisees.onboarding_step IS 'Tracks progress: payment, intake, representatives, contract, complete';