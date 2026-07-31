import { usePortal } from '@/contexts/PortalContext';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { PORTAL } from '@/constants';

export default function PortalNotFound() {
  const { error, retry, loading } = usePortal();

  const isConnectionError = error?.includes('Connection') || error?.includes('Unable to load');
  const isNoSubdomain = error === 'no_subdomain';

  if (isNoSubdomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Home className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Welcome to Ignite
          </h1>
          <p className="text-muted-foreground mb-6">
            Please access your organization's portal using your dedicated subdomain.
          </p>
          <p className="text-sm text-muted-foreground">
            Example: <span className="font-mono text-primary">app-signup-qa.{PORTAL.BASE_DOMAIN}/onboarding/your-portal-id</span>
          </p>
        </div>
      </div>
    );
  }

  if (isConnectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Connection Error
          </h1>
          <p className="text-muted-foreground mb-6">
            We're having trouble connecting to the server. Please check your internet connection and try again.
          </p>
          <Button onClick={retry} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Retrying...' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  // Portal not found
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Portal Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
          The portal you're looking for doesn't exist or may have been removed. Please check the URL and try again.
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact your organization administrator.
        </p>
      </div>
    </div>
  );
}
