-- Admin portal is invite-only: never auto-assign admin/super_admin on signup.
-- Only franchisee is assigned by default; admin/super_admin are set when a Super Admin invites via User Management.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
BEGIN
  -- All new signups get franchisee by default. Admin and super_admin roles
  -- are only assigned when a Super Admin invites a user via the admin portal.
  assigned_role := 'franchisee';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_role() IS 'Assigns franchisee to every new auth user. Admin/super_admin are invite-only (set by Super Admin in User Management).';
