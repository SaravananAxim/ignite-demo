import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import igniteLogo from '@/assets/ignite-logo.webp';

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters');

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { user, loading: authLoading, updatePassword, role } = useUser();
  const navigate = useNavigate();

  // Allow Supabase to process the recovery hash from the URL (hash is parsed asynchronously)
  const hasHash = typeof window !== 'undefined' && window.location.hash.length > 0;
  useEffect(() => {
    if (!hasHash) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, [hasHash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passValidation = passwordSchema.safeParse(password);
    if (!passValidation.success) {
      setError(passValidation.error.errors[0].message);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast.success('Password updated. You can sign in now.');
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin/login', { replace: true });
      } else if (role === 'franchisee') {
        navigate('/franchisee-auth', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLoading = authLoading || !ready;
  const hasRecoverySession = !!user;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Checking your link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Invalid or expired link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request a new one from the sign-in page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/auth', { replace: true })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elevated border border-border rounded-lg">
        <CardHeader className="text-center space-y-4 p-card-padding pb-0">
          <div className="mx-auto">
            <img src={igniteLogo} alt="Ignite" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle className="text-page-title text-foreground">Set new password</CardTitle>
            <CardDescription className="text-body text-muted-foreground mt-2">
              Enter your new password below.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-card-padding">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-md border-border"
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <p className="text-xs text-muted-foreground">At least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 rounded-md border-border"
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-md font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
