import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PORTAL } from '@/constants';

export const PORTAL_STORAGE_KEY = PORTAL.STORAGE_KEY_SUBDOMAIN;

interface Portal {
  portal_id: string;
  portal_name: string;
  require_payment: boolean;
  subdomain: string;
}

interface PortalContextType {
  portal: Portal | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

/**
 * Extracts subdomain from the current URL relative to the configured BASE_DOMAIN
 * Example: For BASE_DOMAIN = 'rallio.com'
 *   - rallio.com → null (root, no subdomain)
 *   - signup-test-qa.rallio.com → 'test'
 *   - signup-demo-qa.rallio.com → 'demo'
 * Returns null for root domain, IP addresses, or localhost without subdomain
 */
function extractSubdomain(): string | null {
  // Check for query parameter override first (for testing without DNS)
  const urlParams = new URLSearchParams(window.location.search);
  const portalParam = urlParams.get('portal');
  if (portalParam) {
    return portalParam.toLowerCase();
  }

  const hostname = window.location.hostname.toLowerCase();
  const baseDomain = PORTAL.BASE_DOMAIN.toLowerCase();
  
  // Handle IP addresses - no subdomain possible
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    return null;
  }
  
  // Handle localhost (no subdomain)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  // Handle *.localhost (e.g., test.localhost:3000)
  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.replace('.localhost', '');
    return subdomain || null;
  }
  
  // Check if hostname matches or is a subdomain of BASE_DOMAIN
  if (hostname === baseDomain) {
    // Exact match to base domain - no subdomain
    return null;
  }
  
  if (hostname.endsWith(`.${baseDomain}`)) {
    // Extract subdomain from hostname pattern: signup-{subdomain}-qa.rallio.com
    // e.g., signup-test-qa.rallio.com -> test
    const prefix = hostname.replace(`.${baseDomain}`, '');
    const subdomain = prefix.replace(/^signup-/, '').replace(/-qa$/, '');
    
    // Ignore common non-portal subdomains
    const ignoredSubdomains = ['www', 'api', 'admin', 'app'];
    if (ignoredSubdomains.includes(subdomain)) {
      return null;
    }
    
    return subdomain || null;
  }
  
  // Hostname doesn't match base domain pattern - fallback for other deployments
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return null;
  }
  
  const subdomain = parts[0];
  const ignoredSubdomains = ['www', 'api', 'admin', 'app'];
  if (ignoredSubdomains.includes(subdomain)) {
    return null;
  }
  
  return subdomain;
}

interface PortalProviderProps {
  children: ReactNode;
  /**
   * Optional: Override subdomain detection for development/testing
   * Set to a subdomain string to force a specific portal
   */
  devSubdomain?: string;
}

export function PortalProvider({ children, devSubdomain }: PortalProviderProps) {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchPortal = async (subdomain: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use case-insensitive lookup for portal subdomain
      const { data, error: dbError } = await supabase
        .from('portals')
        .select('id, name, require_payment, subdomain')
        .ilike('subdomain', subdomain)
        .maybeSingle();

      if (dbError) {
        console.error('Portal fetch error:', dbError);
        setError('Unable to load portal. Please try again.');
        setPortal(null);
        return;
      }

      if (!data) {
        setError('Portal not found');
        setPortal(null);
        return;
      }

      setPortal({
        portal_id: data.id,
        portal_name: data.name,
        require_payment: data.require_payment,
        subdomain: data.subdomain,
      });
      setError(null);
      try {
        sessionStorage.setItem(PORTAL.STORAGE_KEY_SUBDOMAIN, data.subdomain);
      } catch {
        // Ignore storage errors
      }
    } catch (err) {
      console.error('Portal fetch exception:', err);
      setError('Connection error. Please check your internet and try again.');
      setPortal(null);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    // Use dev subdomain override if provided, otherwise extract from URL
    const subdomain = devSubdomain || extractSubdomain();

    if (!subdomain) {
      // No subdomain detected - this is the root domain or invalid access
      setLoading(false);
      setError('no_subdomain');
      return;
    }

    fetchPortal(subdomain);
  }, [devSubdomain, retryCount]);

  return (
    <PortalContext.Provider value={{ portal, loading, error, retry }}>
      {children}
    </PortalContext.Provider>
  );
}

/**
 * Hook to access portal context
 * Must be used within a PortalProvider
 */
export function usePortal(): PortalContextType {
  const context = useContext(PortalContext);
  
  if (context === undefined) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  
  return context;
}

/**
 * Utility to check if we're in a portal context (has subdomain)
 */
export function useIsPortalContext(): boolean {
  const { error } = usePortal();
  return error !== 'no_subdomain';
}
