import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, AlertCircle, Mail } from 'lucide-react';
import { z } from 'zod';
import igniteLogo from '@/assets/ignite-logo.webp';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRoleCheck, setPendingRoleCheck] = useState(false);

  const { signInWithOtp, verifyOtp, signOut, user, role, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin/dashboard';

  // After OTP verify: only allow admin/super_admin to proceed. Franchisees must never see admin UI.
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
    setCode('');
    setCodeSent(false);
  }, [pendingRoleCheck, user, role, authLoading, navigate, from, signOut]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await signInWithOtp(email, {
        shouldCreateUser: false,
      });

      if (otpError) {
        if (otpError.message.includes('Signups not allowed') || otpError.message.includes('signups_disabled')) {
          setError('No admin account found for this email. Access is by invitation only.');
        } else {
          setError(otpError.message);
        }
        return;
      }

      setCodeSent(true);
      setCode('');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = code.replace(/\s/g, '');
    if (trimmed.length !== 8) {
      setError('Please enter the 8-digit code from your email.');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await verifyOtp(email, trimmed);

      if (verifyError) {
        setError(verifyError.message || 'Invalid or expired code. Request a new one.');
        return;
      }

      setPendingRoleCheck(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCodeSent(false);
    setCode('');
    setError(null);
  };

  if (codeSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <img src={igniteLogo} alt="Ignite" className="h-10 w-auto" />
              <span className="font-semibold text-xl">Admin</span>
            </div>
            <CardTitle className="text-2xl font-bold">Enter verification code</CardTitle>
            <CardDescription>
              We sent an 8-digit code to <strong>{email}</strong>. Enter it below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <InputOTP
                  maxLength={8}
                  value={code}
                  onChange={setCode}
                  disabled={loading}
                >
                  <InputOTPGroup className="gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || code.replace(/\s/g, '').length !== 8}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & continue'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            Sign in to your admin account with a verification code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendCode} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
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
