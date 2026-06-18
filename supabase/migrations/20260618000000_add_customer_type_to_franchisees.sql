-- Add customer_type to franchisees table
ALTER TABLE public.franchisees 
ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'new' CHECK (customer_type IN ('new', 'existing'));
