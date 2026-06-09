-- Add address field to franchisees table
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS address TEXT;