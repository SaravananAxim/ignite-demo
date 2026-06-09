-- Add requires_paid_media column to plans table
ALTER TABLE public.plans 
ADD COLUMN requires_paid_media boolean NOT NULL DEFAULT false;