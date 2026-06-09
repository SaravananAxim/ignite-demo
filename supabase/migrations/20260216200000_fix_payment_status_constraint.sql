-- Fix payment_status check constraint to include all valid statuses
-- The original constraint only allowed: pending, authorized, paid, failed, cancelled
-- Missing: pending_checkout, trialing, past_due
ALTER TABLE public.franchisees
DROP CONSTRAINT IF EXISTS franchisees_payment_status_check;

ALTER TABLE public.franchisees
ADD CONSTRAINT franchisees_payment_status_check
CHECK (payment_status IN ('pending', 'pending_checkout', 'authorized', 'trialing', 'paid', 'past_due', 'failed', 'cancelled'));
