import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText, 
  LogOut,
  ChevronRight,
  ScrollText,
  Shield,
  Activity,
  Menu,
  CheckCircle2,
  Webhook,
  Search,
  Tag,
  Package,
  Trophy,
  KeyRound,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import igniteLogo from '@/assets/ignite-logo.webp';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pending-signatures', label: 'Pending Signatures', icon: ScrollText, superAdminOnly: true },
  { href: '/admin/completed-signups', label: 'Completed Sign-ups', icon: CheckCircle2 },
  { href: '/portals', label: 'Portals', icon: Building2 },
  { href: '/brands', label: 'Brands', icon: Users },
  { href: '/plans', label: 'Plans', icon: FileText },
  { href: '/admin/skus', label: 'SKU Catalog', icon: Tag },
  { href: '/admin/products', label: 'Products', icon: Layers },
  { href: '/admin/packages', label: 'Packages', icon: Package },
  { href: '/admin/programs', label: 'Programs', icon: Trophy },
  { href: '/admin/contracts', label: 'Contracts', icon: ScrollText },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/admin/logs', label: 'Activity Logs', icon: Activity },
  { href: '/admin/users', label: 'User Management', icon: Shield, superAdminOnly: true },
  { href: '/admin/api-keys', label: 'API Keys', icon: KeyRound, superAdminOnly: true },
];

function NavContent({ role, location, onItemClick }: { 
  role: string | null; 
  location: { pathname: string }; 
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems
        .filter((item) => !item.superAdminOnly || role === 'super_admin')
        .map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === '/admin/portal-builder' && location.pathname.startsWith('/admin/portal-builder'));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
            </Link>
          );
        })}
    </nav>
  );
}

function UserSection({ user, role, handleSignOut }: { 
  user: { email?: string } | null; 
  role: string | null; 
  handleSignOut: () => void;
}) {
  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 rounded-lg bg-muted/50 p-3">
        <p className="text-sm font-medium truncate">{user?.email}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut, role } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsSearchOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex flex-col border-b border-border bg-card lg:hidden">
        <div className="h-[env(safe-area-inset-top,0px)] shrink-0 bg-card" aria-hidden />
        <div className="flex h-14 items-center gap-3 px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-14 items-center gap-3 border-b border-border px-6">
                <img src={igniteLogo} alt="Ignite" className="h-8 w-auto" />
                <span className="font-semibold text-lg">Admin</span>
              </div>

              <NavContent 
                role={role} 
                location={location} 
                onItemClick={() => setMobileOpen(false)} 
              />

              <UserSection user={user} role={role} handleSignOut={handleSignOut} />
            </div>
          </SheetContent>
        </Sheet>
        <img src={igniteLogo} alt="Ignite" className="h-7 w-auto" />
        <span className="font-semibold">Admin</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Open global search"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:block lg:h-screen lg:w-64 lg:border-r lg:border-border lg:bg-card">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-border px-6">
            <img src={igniteLogo} alt="Ignite" className="h-8 w-auto" />
            <span className="font-semibold text-lg">Admin</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Open global search"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>

          <NavContent role={role} location={location} />

          <UserSection user={user} role={role} handleSignOut={handleSignOut} />
        </div>
      </aside>

      <AdminGlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />

      {/* Main content */}
      <main className="min-w-0 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pl-64 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
