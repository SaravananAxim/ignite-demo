-- =============================================
-- SECURITY HARDENING MIGRATION v2
-- Fix all identified RLS policy gaps
-- =============================================

-- 1. FIX: activity_logs - add super_admin to existing policy
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity logs " ON public.activity_logs;
CREATE POLICY "Admins and super admins can view activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. FIX: profiles - add INSERT policy for system trigger
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Allow authenticated users to insert their own profile (for edge cases)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. FIX: generated_contracts - allow franchisees to view their own contracts
DROP POLICY IF EXISTS "Franchisees can view their own contracts" ON public.generated_contracts;
CREATE POLICY "Franchisees can view own contracts"
ON public.generated_contracts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.franchisees 
    WHERE franchisees.id = generated_contracts.franchisee_id 
    AND franchisees.user_id = auth.uid()
  )
);

-- 4. FIX: user_roles - prevent privilege escalation
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles " ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles " ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles " ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage super admin roles" ON public.user_roles;

-- Admins can view all roles
CREATE POLICY "Admin role read access"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Users can view their own role
CREATE POLICY "User own role read access"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only super_admins can modify roles (not regular admins - prevents privilege escalation)
CREATE POLICY "Super admin role management"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. FIX: portals - restrict modifications to admins only
DROP POLICY IF EXISTS "Portals are publicly viewable" ON public.portals;
DROP POLICY IF EXISTS "Portals are publicly viewable " ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can delete portals" ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can delete portals " ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can insert portals" ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can insert portals " ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can update portals" ON public.portals;
DROP POLICY IF EXISTS "Authenticated users can update portals " ON public.portals;
DROP POLICY IF EXISTS "Portals are readable for routing" ON public.portals;
DROP POLICY IF EXISTS "Admins can insert portals" ON public.portals;
DROP POLICY IF EXISTS "Admins can update portals" ON public.portals;
DROP POLICY IF EXISTS "Admins can delete portals" ON public.portals;

-- Public read for portal routing
CREATE POLICY "Portal public read"
ON public.portals
FOR SELECT
USING (true);

-- Admin modifications only
CREATE POLICY "Portal admin insert"
ON public.portals
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Portal admin update"
ON public.portals
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Portal admin delete"
ON public.portals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 6. FIX: brands - restrict modifications to admins only
DROP POLICY IF EXISTS "Brands are publicly viewable" ON public.brands;
DROP POLICY IF EXISTS "Brands are publicly viewable " ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can delete brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can delete brands " ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can insert brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can insert brands " ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can update brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can update brands " ON public.brands;
DROP POLICY IF EXISTS "Brands are readable for display" ON public.brands;
DROP POLICY IF EXISTS "Admins can insert brands" ON public.brands;
DROP POLICY IF EXISTS "Admins can update brands" ON public.brands;
DROP POLICY IF EXISTS "Admins can delete brands" ON public.brands;

-- Public read for brand display
CREATE POLICY "Brand public read"
ON public.brands
FOR SELECT
USING (true);

-- Admin modifications only
CREATE POLICY "Brand admin insert"
ON public.brands
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Brand admin update"
ON public.brands
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Brand admin delete"
ON public.brands
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 7. FIX: plans - restrict modifications to admins only
DROP POLICY IF EXISTS "Plans are publicly viewable" ON public.plans;
DROP POLICY IF EXISTS "Plans are publicly viewable " ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can delete plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can delete plans " ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can insert plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can insert plans " ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can update plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can update plans " ON public.plans;
DROP POLICY IF EXISTS "Plans are readable for selection" ON public.plans;
DROP POLICY IF EXISTS "Admins can insert plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can update plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can delete plans" ON public.plans;

-- Public read for plan selection
CREATE POLICY "Plan public read"
ON public.plans
FOR SELECT
USING (true);

-- Admin modifications only
CREATE POLICY "Plan admin insert"
ON public.plans
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Plan admin update"
ON public.plans
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Plan admin delete"
ON public.plans
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 8. FIX: contract_templates - restrict to authenticated users
DROP POLICY IF EXISTS "Templates are publicly viewable" ON public.contract_templates;
DROP POLICY IF EXISTS "Templates are publicly viewable " ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.contract_templates;

-- Only authenticated users can view templates
CREATE POLICY "Template authenticated read"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (true);

-- 9. PREVENT: Last super_admin deletion
CREATE OR REPLACE FUNCTION public.prevent_last_superadmin_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last super_admin role';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_superadmin ON public.user_roles;
CREATE TRIGGER prevent_last_superadmin
BEFORE DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_superadmin_deletion();