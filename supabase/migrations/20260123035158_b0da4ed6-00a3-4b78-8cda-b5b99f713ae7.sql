-- Add contract_template_id column to plans table
-- One template per plan, but a template can be used by multiple plans
ALTER TABLE public.plans
ADD COLUMN contract_template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL;

-- Add an index for efficient lookups
CREATE INDEX idx_plans_contract_template ON public.plans(contract_template_id);