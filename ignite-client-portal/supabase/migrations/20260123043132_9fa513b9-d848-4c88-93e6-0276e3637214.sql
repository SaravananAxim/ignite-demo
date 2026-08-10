-- Drop the existing status check constraint
ALTER TABLE public.franchisees DROP CONSTRAINT IF EXISTS franchisees_status_check;

-- Add updated constraint with all valid status values
ALTER TABLE public.franchisees ADD CONSTRAINT franchisees_status_check 
CHECK (status IN (
  'pending',
  'payment_completed',
  'contract_signed', 
  'awaiting_countersign',
  'completed',
  'active',
  'inactive',
  'cancelled'
));