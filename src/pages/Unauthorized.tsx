import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft, Home, LogOut } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { role, signOut, isAuthenticated } = useUser();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Determine the user's role to provide appropriate messaging
  const isAdminOnFranchiseePage = role === 'admin' || role === 'super_admin';
  const isFranchiseeOnAdminPage = role === 'franchisee';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Access Denied
        </h1>
        
        {isFranchiseeOnAdminPage ? (
          <>
            <p className="text-muted-foreground mb-2">
              You don&apos;t have access to this page.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Use the buttons below to go to your account or sign out.
            </p>
          </>
        ) : isAdminOnFranchiseePage ? (
          <>
            <p className="text-muted-foreground mb-2">
              You're logged in as an admin. The franchise portal is for franchisee accounts only.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              To test the franchisee experience, sign out and create a franchisee account, or use a different browser.
            </p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-2">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Please contact your administrator if you believe this is an error.
            </p>
          </>
        )}
        
        <div className="flex flex-wrap gap-3 justify-center">
          {!isFranchiseeOnAdminPage && (
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          )}
          {isFranchiseeOnAdminPage ? (
            <>
              <Button onClick={() => navigate('/my-locations')}>
                <Home className="mr-2 h-4 w-4" />
                My Locations
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : isAdminOnFranchiseePage ? (
            <>
              <Button onClick={() => navigate('/admin/dashboard')}>
                Admin Dashboard
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/')}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
