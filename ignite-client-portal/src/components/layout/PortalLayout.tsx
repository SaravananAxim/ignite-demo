import { ReactNode, forwardRef } from 'react';
import { TopNav } from './TopNav';
import { InfoBanner } from './InfoBanner';
import { usePortal } from '@/contexts/PortalContext';

interface PortalLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  infoBannerText?: string;
}

export const PortalLayout = forwardRef<HTMLDivElement, PortalLayoutProps>(function PortalLayout(
  { 
    children, 
    showBackButton = true, 
    backTo,
    backLabel,
    infoBannerText,
  },
  ref
) {
  const { portal } = usePortal();

  return (
    <div ref={ref} className="min-h-screen min-w-0 bg-background">
      <TopNav 
        showBackButton={showBackButton} 
        backTo={backTo}
        backLabel={backLabel}
      />
      
      {/* Main content with top padding for fixed nav */}
      <main className="min-w-0 pt-[calc(theme(spacing.nav-height)+env(safe-area-inset-top,0px))]">
        <div className="content-max px-4 sm:px-6 md:px-content-padding py-6">
          {/* Info Banner */}
          {infoBannerText && (
            <InfoBanner>{infoBannerText}</InfoBanner>
          )}
          
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="content-max px-4 sm:px-6 md:px-content-padding text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {portal?.portal_name || 'Ignite'}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
});

PortalLayout.displayName = 'PortalLayout';

