-- Add foreign key from generated_contracts to franchisees
ALTER TABLE public.generated_contracts
  ADD CONSTRAINT generated_contracts_franchisee_id_fkey
  FOREIGN KEY (franchisee_id)
  REFERENCES public.franchisees(id)
  ON DELETE CASCADE;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generated_contracts_franchisee_id
  ON public.generated_contracts(franchisee_id);