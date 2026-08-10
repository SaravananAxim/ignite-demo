import { ReactNode } from "react";
import { useUser } from "@/contexts/UserContext";
import { usePortal } from "@/contexts/PortalContext";
import { Loader2 } from "lucide-react";

/**
 * Renders children only after auth and portal context have finished initializing.
 * Shows a single full-screen spinner until then so we never paint a route in an
 * in-between state (which can appear as a blank white screen).
 */
export function AppBoot({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useUser();
  const { loading: portalLoading } = usePortal();

  if (authLoading || portalLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}
