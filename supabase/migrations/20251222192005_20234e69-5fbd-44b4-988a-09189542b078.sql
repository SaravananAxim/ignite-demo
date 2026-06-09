-- Create portals table
CREATE TABLE public.portals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subdomain TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  require_payment BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  monthly_price DECIMAL(10, 2) NOT NULL,
  stripe_payment_link TEXT NOT NULL,
  stripe_payment_link_with_media TEXT,
  supports_paid_media BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX idx_brands_portal_id ON public.brands(portal_id);
CREATE INDEX idx_plans_brand_id ON public.plans(brand_id);
CREATE INDEX idx_portals_subdomain ON public.portals(subdomain);

-- RLS Policies for public read access (portals are publicly viewable by subdomain)
CREATE POLICY "Portals are publicly viewable" 
ON public.portals 
FOR SELECT 
USING (true);

CREATE POLICY "Brands are publicly viewable" 
ON public.brands 
FOR SELECT 
USING (true);

CREATE POLICY "Plans are publicly viewable" 
ON public.plans 
FOR SELECT 
USING (true);

-- For authenticated users to manage data (admin functionality)
CREATE POLICY "Authenticated users can insert portals" 
ON public.portals 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update portals" 
ON public.portals 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete portals" 
ON public.portals 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert brands" 
ON public.brands 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update brands" 
ON public.brands 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete brands" 
ON public.brands 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert plans" 
ON public.plans 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update plans" 
ON public.plans 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete plans" 
ON public.plans 
FOR DELETE 
USING (auth.uid() IS NOT NULL);