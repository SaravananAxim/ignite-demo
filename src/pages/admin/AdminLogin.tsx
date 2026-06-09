import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Mail, Lock } from 'lucide-react';
import { z } from 'zod';
import igniteLogo from '@/assets/ignite-logo.webp';

const credentialsSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRoleCheck, setPendingRoleCheck] = useState(false);

  const { signIn, resetPassword, signOut, user, role, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin/dashboard';

  // After sign in: only allow admin/super_admin to proceed. Franchisees must never see admin UI.
  useEffect(() => {
    if (!pendingRoleCheck || !user || authLoading) return;

    if (role === 'admin' || role === 'super_admin') {
      setPendingRoleCheck(false);
      navigate(from, { replace: true });
      return;
    }

    // Franchisee or any non-admin: sign out and block. No admin info, no UI.
    setPendingRoleCheck(false);
    signOut();
    setError('You do not have access to the admin portal.');
  }, [pendingRoleCheck, user, role, authLoading, navigate, from, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = credentialsSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Incorrect email or password.');
        } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setError('Please confirm your email before signing in.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      setPendingRoleCheck(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    const validation = z.string().email().safeParse(email);
    if (!validation.success) {
      setError('Enter your email above, then select "Forgot password".');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      toast.success('If an admin account exists for that email, a reset link is on its way.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <img src={igniteLogo} alt="Ignite" className="h-10 w-auto" />
            <span className="font-semibold text-xl">Admin</span>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your admin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@ignitevisibility.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !email || !password}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Admin portal is invite-only</p>
            <p>There is no sign-up. Access is by invitation only. Contact a Super Admin to be invited.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
