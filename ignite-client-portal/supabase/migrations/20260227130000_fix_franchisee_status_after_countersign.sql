-- Fix franchisee status for contracts that have already been fully counter-signed.
-- When a contract in generated_contracts has status = 'fully_signed', the corresponding
-- franchisee should have status = 'completed'. Previously the counter-sign flow only
-- updated generated_contracts and left franchisees.status stuck on 'awaiting_countersign'.

UPDATE public.franchisees f
SET status = 'completed'
FROM public.generated_contracts gc
WHERE gc.franchisee_id = f.id
  AND gc.status = 'fully_signed'
  AND f.status = 'awaiting_countersign';
