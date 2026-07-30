import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { usePortal } from '@/contexts/PortalContext';
import { PORTAL } from '@/constants';
import Dashboard from './Dashboard';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, role } = useUser();
  const { portal, loading: portalLoading } = usePortal();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || portalLoading) return;

    // Password reset: if URL has recovery hash (from email link), always send to reset page
    // so user can set a new password instead of being redirected to dashboard
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`, { replace: true });
      return;
    }

    // If a portal is detected (via subdomain or ?portal= param), send them to the portal
    if (portal) {
      const path = user ? '/select-brand' : '/franchisee-auth';
      const search = window.location.search || '';
      // When we're on root with ?portal=, do a full redirect to the portal subdomain so the
      // URL is correct and subdomain is persisted for the session
      const onRoot = typeof window !== 'undefined' && window.location.hostname.toLowerCase() === PORTAL.BASE_DOMAIN.toLowerCase();
      if (onRoot) {
        const params = new URLSearchParams(search);
        params.delete('portal');
        const qs = params.toString();
        const hash = window.location.hash || '';
        window.location.href = `${PORTAL.getPortalUrl(portal.portal_id)}${path}${qs ? '?' + qs : ''}${hash}`;
        return;
      }
      if (user) {
        navigate(`/select-brand${search}`, { replace: true });
      } else {
        navigate(`/franchisee-auth${search}`, { replace: true });
      }
      return;
    }

    // On root with no portal in URL: redirect franchisees and unauthenticated users
    // to their persisted portal so they don't get an invalid/root experience
    const storedPortalId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PORTAL.STORAGE_KEY_SUBDOMAIN) : null;
    if (storedPortalId && (role === 'franchisee' || !user)) {
      const path = user ? '/my-locations' : '/franchisee-auth';
      const search = window.location.search || '';
      window.location.href = `${PORTAL.getPortalUrl(storedPortalId)}${path}${search}`;
      return;
    }

    // No portal context - handle as root domain access
    if (!user) {
      navigate('/auth');
    } else if (role === 'admin' || role === 'super_admin') {
      // Admins go to admin dashboard
      navigate('/admin/dashboard', { replace: true });
    } else if (role === 'franchisee') {
      // Franchisees MUST go to their dashboard - they cannot access root
      navigate('/my-locations', { replace: true });
    }
  }, [user, loading, portal, portalLoading, navigate, role]);

  if (loading || portalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only admins can see the Dashboard on root - franchisees are redirected above
  if (!portal && user && (role === 'admin' || role === 'super_admin')) {
    return <Dashboard />;
  }

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
