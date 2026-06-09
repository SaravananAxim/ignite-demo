import { ReactNode } from 'react';
import { usePortal } from '@/contexts/PortalContext';
import { Loader2 } from 'lucide-react';
import PortalNotFound from '@/pages/PortalNotFound';

interface PortalGateProps {
  children: ReactNode;
  /**
   * If true, allows access even without a valid portal (for admin routes)
   */
  allowWithoutPortal?: boolean;
}

/**
 * Gate component that ensures a valid portal is loaded before rendering children
 * Shows loading state while fetching, error page if portal not found
 */
export function PortalGate({ children, allowWithoutPortal = false }: PortalGateProps) {
  const { portal, loading, error } = usePortal();

  // Show loading spinner while fetching portal
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    );
  }

  // If we allow access without portal (admin routes), render children
  if (allowWithoutPortal) {
    return <>{children}</>;
  }

  // Show error page if there's an error or no portal
  if (error || !portal) {
    return <PortalNotFound />;
  }

  // Portal is valid, render children
  return <>{children}</>;
}
