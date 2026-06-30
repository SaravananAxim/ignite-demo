import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePortal } from '@/contexts/PortalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Mail, ArrowRight, Loader2, WifiOff } from 'lucide-react';
import igniteLogo from '@/assets/ignite-logo.webp';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signInWithOtp, verifyOtp, user, role } = useUser();
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

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.error('You are offline. Please check your connection and try again.');
      return;
    }

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInWithOtp(email, { shouldCreateUser: false });

      if (error) {
        if (error.message.includes('Signups not allowed') || error.message.includes('signups_disabled')) {
          toast.error('No account found for this email. Admin access is by invitation only.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      setCodeSent(true);
      setCode('');
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, '');
    if (trimmed.length !== 8) {
      toast.error('Please enter the 8-digit code from your email.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await verifyOtp(email, trimmed);

      if (error) {
        toast.error(error.message || 'Invalid or expired code. Request a new one.');
        return;
      }
      toast.success('Signed in.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (codeSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-elevated animate-scale-in border border-border rounded-lg">
          <CardHeader className="text-center space-y-4 p-card-padding pb-0">
            <div className="mx-auto">
              <img src={igniteLogo} alt="Ignite" className="h-16 w-auto" />
            </div>
            <div>
              <CardTitle className="text-page-title text-foreground">Enter verification code</CardTitle>
              <CardDescription className="text-body text-muted-foreground mt-2">
                We sent an 8-digit code to <strong className="text-foreground">{email}</strong>. Enter it below.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-card-padding">
            <form onSubmit={handleVerifyCode} className="space-y-4">
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & continue'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                }}
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elevated animate-scale-in border border-border rounded-lg">
        <CardHeader className="text-center space-y-4 p-card-padding pb-0">
          <div className="mx-auto">
            <img src={igniteLogo} alt="Ignite" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle className="text-page-title text-foreground">Admin sign in</CardTitle>
            <CardDescription className="text-body text-muted-foreground mt-2">
              Sign in to access the admin portal with a verification code
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              Franchisees: Use your brand&apos;s signup portal to access your account.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSendCode}>
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
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
