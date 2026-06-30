import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePortal } from '@/contexts/PortalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Mail, ArrowRight, Loader2, WifiOff, Lock } from 'lucide-react';
import igniteLogo from '@/assets/ignite-logo.webp';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, resetPassword, user, role } = useUser();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { portal } = usePortal();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`, { replace: true });
      return;
    }

    if (portal) {
      navigate(`/franchisee-auth${window.location.search}`, { replace: true });
      return;
    }

    if (user && role) {
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'franchisee') {
        toast.info('Please use the franchisee portal to access your account');
        navigate('/franchisee-auth', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, role, navigate, portal]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.error('You are offline. Please check your connection and try again.');
      return;
    }

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast.error(error.message || 'Unable to sign in. Please check your credentials and try again.');
        return;
      }

      toast.success('Signed in.');
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isOnline) {
      toast.error('You are offline. Please check your connection and try again.');
      return;
    }

    const emailValidation = z.object({ email: z.string().email('Please enter a valid email address') }).safeParse({ email });
    if (!emailValidation.success) {
      toast.error(emailValidation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message || 'Could not send password reset email.');
        return;
      }

      toast.success('Password reset email sent. Check your inbox.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elevated animate-scale-in border border-border rounded-lg">
        <CardHeader className="text-center space-y-4 p-card-padding pb-0">
          <div className="mx-auto">
            <img src={igniteLogo} alt="Ignite" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle className="text-page-title text-foreground">Admin sign in</CardTitle>
            <CardDescription className="text-body text-muted-foreground mt-2">
              Sign in to access the admin portal with your email and password
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              Franchisees: Use your brand&apos;s signup portal to access your account.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSignIn}>
          <CardContent className="space-y-5 p-card-padding">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-body-medium text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-md border-border"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-body-medium text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-md border-border"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 p-card-padding pt-0">
            {!isOnline && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <WifiOff className="w-3.5 h-3.5" />
                <span>You&apos;re offline. Sign in will work when you&apos;re back online.</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 rounded-md font-semibold gap-2"
              disabled={loading || !isOnline}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleForgotPassword}
              disabled={loading || !isOnline}
            >
              Forgot password?
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
