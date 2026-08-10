-- Add monthly_price_with_media column to store the actual price amount
ALTER TABLE public.plans 
ADD COLUMN monthly_price_with_media numeric DEFAULT NULL;