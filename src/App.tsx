import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PortalProvider } from "@/contexts/PortalContext";
import { UserProvider } from "@/contexts/UserContext";
import { NetworkStatus } from "@/components/ui/network-status";
import { AppBoot } from "@/components/AppBoot";
import { AppRoutes } from "@/routes";
import { Analytics } from "@vercel/analytics/react";
import { GoogleAnalyticsTracker } from "@/components/GoogleAnalyticsTracker";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      // Avoid refetch-on-window-focus so returning to the tab doesn’t trigger a full re-fetch and re-render
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Development subdomain override
 * Set this to test specific portals in development (e.g., "test")
 * In production, subdomain is extracted from URL automatically
 */
const DEV_SUBDOMAIN = import.meta.env.DEV ? undefined : undefined;

/**
 * Main Application Component
 * 
 * Provider hierarchy:
 * 1. QueryClientProvider - React Query for data fetching
 * 2. TooltipProvider - Radix UI tooltips
 * 3. PortalProvider - Multi-tenant portal context
 * 4. UserProvider - Authentication and user context
 */
const App = () => (
  <div className="min-h-screen w-full min-w-0">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PortalProvider devSubdomain={DEV_SUBDOMAIN}>
          <UserProvider>
            <Toaster />
            <NetworkStatus />
            <BrowserRouter>
              <GoogleAnalyticsTracker />
              <AppBoot>
                <AppRoutes />
              </AppBoot>
            </BrowserRouter>
            <Analytics />
          </UserProvider>
        </PortalProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </div>
);

export default App;
