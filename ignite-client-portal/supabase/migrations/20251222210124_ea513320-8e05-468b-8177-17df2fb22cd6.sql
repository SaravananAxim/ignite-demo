-- Add new columns to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS domain_pattern text,
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#10B981';

-- Add new columns to plans table for features and pricing tier
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS pricing_tier text DEFAULT 'starter' CHECK (pricing_tier IN ('free', 'starter', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{
  "custom_domain": false,
  "ssl": true,
  "templates": true,
  "email_campaigns": false,
  "analytics": false,
  "api_access": false,
  "white_label": false,
  "max_portals": 1
}'::jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'));