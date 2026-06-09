-- Extend franchisees table with payment and signature fields
ALTER TABLE public.franchisees 
ADD COLUMN IF NOT EXISTS location_details jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS signature_data text,
ADD COLUMN IF NOT EXISTS signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'cancelled')),
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS service_start_date date,
ADD COLUMN IF NOT EXISTS include_paid_media boolean DEFAULT false;

-- Extend generated_contracts table with signature fields
ALTER TABLE public.generated_contracts 
ADD COLUMN IF NOT EXISTS franchisee_signature text,
ADD COLUMN IF NOT EXISTS franchisee_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS counter_signature text,
ADD COLUMN IF NOT EXISTS counter_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS signed_pdf_url text;

-- Update generated_contracts status check to include new statuses
ALTER TABLE public.generated_contracts 
DROP CONSTRAINT IF EXISTS generated_contracts_status_check;

ALTER TABLE public.generated_contracts 
ADD CONSTRAINT generated_contracts_status_check 
CHECK (status IN ('draft', 'pending_signature', 'signed_by_franchisee', 'fully_signed', 'sent', 'signed'));

-- Extend plans table with Stripe and billing config
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id_with_media text,
ADD COLUMN IF NOT EXISTS setup_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS billing_anchor_day integer DEFAULT 15;

-- Add contract_only_mode to portals
ALTER TABLE public.portals 
ADD COLUMN IF NOT EXISTS contract_only_mode boolean DEFAULT false;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_franchisees_stripe_customer_id ON public.franchisees(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_franchisees_payment_status ON public.franchisees(payment_status);
CREATE INDEX IF NOT EXISTS idx_generated_contracts_status ON public.generated_contracts(status);