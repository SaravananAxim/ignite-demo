-- Add brand-level toggle for choosing one plan per category.
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS multi_plan_logic boolean DEFAULT false;

-- Persist multi-plan selections while keeping franchisees.plan_id as the primary/compatibility plan.
CREATE TABLE IF NOT EXISTS public.franchisee_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    franchisee_id UUID NOT NULL REFERENCES public.franchisees(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    category TEXT NOT NULL DEFAULT 'Other',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (franchisee_id, category),
    UNIQUE (franchisee_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_franchisee_plans_franchisee_id ON public.franchisee_plans(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_franchisee_plans_plan_id ON public.franchisee_plans(plan_id);

ALTER TABLE public.franchisee_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and super admins can view all franchisee plans"
ON public.franchisee_plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins and super admins can insert franchisee plans"
ON public.franchisee_plans
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins and super admins can update franchisee plans"
ON public.franchisee_plans
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins and super admins can delete franchisee plans"
ON public.franchisee_plans
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view own franchisee plans"
ON public.franchisee_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own franchisee plans"
ON public.franchisee_plans
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own franchisee plans"
ON public.franchisee_plans
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own franchisee plans"
ON public.franchisee_plans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
);

CREATE POLICY "Anonymous can view unclaimed franchisee plans"
ON public.franchisee_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = franchisee_plans.franchisee_id
    AND franchisees.user_id IS NULL
  )
);

DROP TRIGGER IF EXISTS update_franchisee_plans_updated_at ON public.franchisee_plans;
CREATE TRIGGER update_franchisee_plans_updated_at
BEFORE UPDATE ON public.franchisee_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
