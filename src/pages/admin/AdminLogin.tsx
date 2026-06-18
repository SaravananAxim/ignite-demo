import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Mail, Lock } from 'lucide-react';
import { z } from 'zod';
import igniteLogo from '@/assets/ignite-logo.webp';

const authSchema = z.object({
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

  // After login: only allow admin/super_admin to proceed. Franchisees must never see admin UI.
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError.message || 'Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      setPendingRoleCheck(true);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    const emailValidation = z.object({ email: z.string().email('Please enter a valid email address') }).safeParse({ email });
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError(resetError.message || 'Could not send password reset email.');
        return;
      }

      setError(null);
      alert('Password reset email sent. Check your inbox.');
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
            Sign in to your admin account with your email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
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
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
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

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Admin portal is invite-only</p>
            <p>Contact a Super Admin if you need to be added as an administrator.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
