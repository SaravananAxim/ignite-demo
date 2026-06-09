import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Layers, 
  LayoutGrid, 
  Building2, 
  CreditCard, 
  LogOut,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import igniteLogo from '@/assets/ignite-logo.webp';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/portals', icon: Layers, label: 'Portals' },
  { href: '/brands', icon: Building2, label: 'Brands' },
  { href: '/plans', icon: CreditCard, label: 'Plans' },
];

function NavContent({
  location,
  onItemClick,
}: {
  location: { pathname: string };
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                onClick={onItemClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-primary' 
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarFooter({ user, onSignOut }: { user: { email?: string } | null; onSignOut: () => void }) {
  return (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center gap-3 px-3 py-2 mb-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-sidebar-foreground">
            {user?.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {user?.email}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={onSignOut}
        className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </Button>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, user } = useUser();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex flex-col border-b border-border bg-card lg:hidden">
        <div className="h-[env(safe-area-inset-top,0px)] shrink-0 bg-card" aria-hidden />
        <div className="flex h-14 items-center gap-3 px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
              <div className="flex h-14 items-center border-b border-sidebar-border px-6">
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 min-w-0"
                >
                  <img src={igniteLogo} alt="Ignite Visibility" className="h-9 w-auto shrink-0" />
                </Link>
              </div>
              <NavContent
                location={location}
                onItemClick={() => setMobileOpen(false)}
              />
              <SidebarFooter user={user} onSignOut={signOut} />
            </div>
          </SheetContent>
        </Sheet>
        <img src={igniteLogo} alt="Ignite" className="h-7 w-auto shrink-0" />
        <span className="font-semibold truncate min-w-0">Ignite Portal</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:h-screen lg:w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={igniteLogo} alt="Ignite Visibility" className="h-10 w-auto" />
          </Link>
        </div>
        <NavContent location={location} />
        <div className="mt-auto">
          <SidebarFooter user={user} onSignOut={signOut} />
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pl-64 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
