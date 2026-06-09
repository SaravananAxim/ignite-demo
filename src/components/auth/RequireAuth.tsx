import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser, AppRole } from '@/contexts/UserContext';
import { PORTAL } from '@/constants';
import { Loader2 } from 'lucide-react';

interface RequireAuthProps {
  children: ReactNode;
  requiredRole?: AppRole;
  redirectTo?: string;
}

/**
 * SECURITY CRITICAL: Protected route wrapper
 * 
 * This component is the ONLY barrier between unauthorized users and protected content.
 * - Franchisees can ONLY access franchisee routes
 * - Admins can access admin routes
 * - Super admins can access admin AND super_admin routes
 * 
 * ANY user without admin/super_admin role MUST be blocked from ALL admin routes.
 */
export function RequireAuth({ 
  children, 
  requiredRole, 
  redirectTo = '/admin/login' 
}: RequireAuthProps) {
  const { isAuthenticated, role, loading } = useUser();
  const location = useLocation();

  // SECURITY: Always show loading while auth state is being determined
  // This prevents any flash of content before role is verified
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to appropriate login
  if (!isAuthenticated) {
    // If redirect is to franchisee-auth, send user to their portal subdomain when possible
    // so they don't land on root and get an invalid experience
    if (redirectTo === '/franchisee-auth') {
      try {
        const storedSubdomain = sessionStorage.getItem(PORTAL.STORAGE_KEY_SUBDOMAIN);
        if (storedSubdomain) {
          const search = location.search || '';
          window.location.href = `${PORTAL.getPortalUrl(storedSubdomain)}/franchisee-auth${search}`;
          return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          );
        }
      } catch {
        // Fall through to client-side Navigate
      }
    }
    const redirectSearch = location.search || '';
    const redirectTarget = redirectTo.includes('?') || !redirectSearch ? redirectTo : `${redirectTo}${redirectSearch}`;
    return <Navigate to={redirectTarget} state={{ from: location }} replace />;
  }

  // SECURITY: If a role is required, we MUST have a valid role to proceed
  if (requiredRole) {
    // Role not loaded or fetch failed - BLOCK ACCESS
    if (!role) {
      console.error('SECURITY: User authenticated but role is null - blocking access');
      return <Navigate to="/unauthorized" replace />;
    }

    // EXPLICIT role checking - no ambiguity
    let hasAccess = false;

    switch (requiredRole) {
      case 'super_admin':
        // ONLY super_admin can access super_admin routes
        hasAccess = role === 'super_admin';
        break;
      
      case 'admin':
        // super_admin and admin can access admin routes
        // FRANCHISEES CANNOT ACCESS ADMIN ROUTES - THIS IS CRITICAL
        hasAccess = role === 'super_admin' || role === 'admin';
        break;
      
      case 'franchisee':
        // ONLY franchisees can access franchisee routes
        // Admins should not access franchisee portal
        hasAccess = role === 'franchisee';
        break;
      
      default:
        // Unknown role requirement - deny by default
        hasAccess = false;
    }

    if (!hasAccess) {
      console.warn(`SECURITY: Access DENIED. User role "${role}" attempted to access route requiring "${requiredRole}" at ${location.pathname}`);
      // Franchisees must never see admin UI or any admin-related page (including Unauthorized copy)
      if (role === 'franchisee' && (requiredRole === 'admin' || requiredRole === 'super_admin')) {
        return <Navigate to="/my-locations" replace />;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

/**
 * Wrapper that redirects authenticated users away from login pages
 * Routes users to their appropriate dashboard based on role
 */
interface RedirectIfAuthenticatedProps {
  children: ReactNode;
  redirectTo?: string;
}

export function RedirectIfAuthenticated({ 
  children, 
  redirectTo = '/' 
}: RedirectIfAuthenticatedProps) {
  const { isAuthenticated, role, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    // SECURITY: Route users based on their ACTUAL role
    // Franchisees MUST go to franchisee pages, NEVER admin
    if (role === 'super_admin' || role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    
    if (role === 'franchisee') {
      // Franchisees go to their dashboard - NEVER to admin
      return <Navigate to="/my-locations" replace />;
    }
    
    // Unknown role - go to home, not admin
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
