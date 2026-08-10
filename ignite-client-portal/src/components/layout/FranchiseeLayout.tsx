import { ReactNode } from 'react';
import { usePortal } from '@/contexts/PortalContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import igniteLogo from '@/assets/ignite-logo.webp';

interface FranchiseeLayoutProps {
  children: ReactNode;
}

export function FranchiseeLayout({ children }: FranchiseeLayoutProps) {
  const { portal } = usePortal();
  const { user, signOut, isAuthenticated } = useUser();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 min-w-0">
          {/* Portal branding */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <img src={igniteLogo} alt="Ignite" className="h-8 w-auto shrink-0" />
            <span className="font-semibold text-base sm:text-lg truncate">
              {portal?.portal_name || 'Portal'}
            </span>
          </div>

          {/* User actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.email}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {portal?.portal_name || 'Ignite'}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
