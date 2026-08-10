-- =============================================
-- SECURITY: Tighten franchisees and generated_contracts RLS
-- Removes overly permissive anonymous policies (USING true / WITH CHECK true)
-- so franchisees and unauthenticated users cannot read or update all rows.
-- =============================================

-- 1. FRANCHISEES: Remove anonymous read/update that allowed anyone to see/change all rows
DROP POLICY IF EXISTS "Anonymous franchisee read by id" ON public.franchisees;
DROP POLICY IF EXISTS "Anonymous franchisee update by id" ON public.franchisees;

-- Allow anonymous to read only unclaimed rows (for resume-onboarding flow)
CREATE POLICY "Anonymous can read unclaimed franchisee rows"
ON public.franchisees
FOR SELECT
USING (user_id IS NULL);

-- Franchisees can update their own row or claim an unclaimed row (user_id stays null or becomes self)
CREATE POLICY "Franchisee can update own or claim unclaimed"
ON public.franchisees
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR user_id IS NULL
)
WITH CHECK (
  user_id IS NULL
  OR user_id = auth.uid()
);

-- Ensure super_admin can manage franchisees (existing policies may only allow admin role)
DROP POLICY IF EXISTS "Admins can view all franchisees" ON public.franchisees;
CREATE POLICY "Admins and super admins can view all franchisees"
ON public.franchisees
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can insert franchisees" ON public.franchisees;
CREATE POLICY "Admins and super admins can insert franchisees"
ON public.franchisees
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update franchisees" ON public.franchisees;
CREATE POLICY "Admins and super admins can update franchisees"
ON public.franchisees
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete franchisees" ON public.franchisees;
CREATE POLICY "Admins and super admins can delete franchisees"
ON public.franchisees
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. GENERATED_CONTRACTS: Remove anonymous read/update that allowed anyone to see/change all contracts
DROP POLICY IF EXISTS "Anonymous contract read" ON public.generated_contracts;
DROP POLICY IF EXISTS "Anonymous contract update" ON public.generated_contracts;

-- Franchisees can update their own contracts (e.g. signing)
CREATE POLICY "Franchisees can update own contracts"
ON public.generated_contracts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees
    WHERE franchisees.id = generated_contracts.franchisee_id
    AND franchisees.user_id = auth.uid()
  )
);

-- Ensure admins (and super_admin) have full access to generated_contracts
DROP POLICY IF EXISTS "Admins can view all contracts" ON public.generated_contracts;
CREATE POLICY "Admins and super admins can view all contracts"
ON public.generated_contracts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can insert contracts" ON public.generated_contracts;
CREATE POLICY "Admins and super admins can insert contracts"
ON public.generated_contracts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update contracts" ON public.generated_contracts;
CREATE POLICY "Admins and super admins can update contracts"
ON public.generated_contracts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete contracts" ON public.generated_contracts;
CREATE POLICY "Admins and super admins can delete contracts"
ON public.generated_contracts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
