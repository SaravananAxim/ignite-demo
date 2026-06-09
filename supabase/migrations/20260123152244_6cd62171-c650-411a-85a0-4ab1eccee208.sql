-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can insert templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

-- Create new policies that allow both admin and super_admin
CREATE POLICY "Admins and super admins can insert templates" 
ON public.contract_templates 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins and super admins can update templates" 
ON public.contract_templates 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins and super admins can delete templates" 
ON public.contract_templates 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));