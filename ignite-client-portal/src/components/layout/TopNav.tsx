import { useNavigate } from 'react-router-dom';
import { usePortal } from '@/contexts/PortalContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import igniteLogo from '@/assets/ignite-logo.webp';

interface TopNavProps {
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function TopNav({ showBackButton = true, backTo, backLabel = 'Back' }: TopNavProps) {
  const { portal } = usePortal();
  const { user, signOut, isAuthenticated } = useUser();
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/franchisee-auth');
  };

  // Get user initial for avatar
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col bg-nav">
      {/* Status bar / notch — keeps toolbar below safe area */}
      <div className="h-[env(safe-area-inset-top,0px)] shrink-0 bg-nav" aria-hidden />
      <div className="flex h-nav-height min-h-nav-height items-center">
      <div className="content-max flex h-full w-full items-center justify-between gap-2 px-4 min-w-0 sm:px-6 md:px-content-padding">
        {/* Left side - Logo and Portal Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-6 h-6 shrink-0">
            <img 
              src={igniteLogo} 
              alt="Ignite" 
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-nav-foreground text-sm sm:text-base font-semibold truncate">
            {portal?.portal_name || 'Ignite Portal'}
          </span>
        </div>

        {/* Right side - User menu and Back button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* User Dropdown */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {userInitial}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Franchisee Account</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/my-locations')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  My Locations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/franchisee-auth')}
              className="text-nav-foreground hover:bg-white/10"
            >
              Sign In
            </Button>
          )}

          {/* Back Button — icon-only on very narrow screens */}
          {showBackButton && (
            <>
              <Button
                onClick={handleBack}
                className="hidden sm:inline-flex h-10 px-[18px] bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {backLabel}
              </Button>
              <Button
                onClick={handleBack}
                size="icon"
                className="sm:hidden h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                aria-label={backLabel}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
