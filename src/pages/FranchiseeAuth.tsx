import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePortal } from '@/contexts/PortalContext';
import { PORTAL } from '@/constants';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Mail, ArrowRight, Loader2, WifiOff, User } from 'lucide-react';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const signupSchema = authSchema.extend({
  fullName: z.string().min(2, 'Please enter your full name'),
});

export default function FranchiseeAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');

  const { signInWithOtp, signUp, verifyOtp, user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOnline } = useNetworkStatus();
  const { portal } = usePortal();
  
  // Get return params from URL
  const planId = searchParams.get('plan_id');
  const brandId = searchParams.get('brand_id');
  const paidMedia = searchParams.get('paid_media');
  const customerType = searchParams.get('customer_type');
  const returnTo = searchParams.get('return_to') || '/select-brand';

  // Redirect if already logged in (unless this is a password reset link)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      navigate(`/auth/reset-password${hash}`, { replace: true });
      return;
    }
    if (user) {
      // Build the return URL with params
      const params = new URLSearchParams();
      if (planId) params.set('plan_id', planId);
      if (brandId) params.set('brand_id', brandId);
      if (paidMedia) params.set('paid_media', paidMedia);
      if (customerType) params.set('customer_type', customerType);
      
      const queryString = params.toString();
      const returnUrl = queryString 
        ? (returnTo.includes('?') ? `${returnTo}&${queryString}` : `${returnTo}?${queryString}`)
        : returnTo;
      
      navigate(returnUrl, { replace: true });
    }
  }, [user, navigate, planId, brandId, paidMedia, customerType, returnTo]);

  const getEmailRedirectTo = (): string => {
    const isPortalSubdomain =
      typeof window !== 'undefined' &&
      window.location.hostname.toLowerCase().endsWith('.' + PORTAL.BASE_DOMAIN.toLowerCase());
    const redirectOrigin = isPortalSubdomain ? `https://${PORTAL.BASE_DOMAIN}` : window.location.origin;
    const params = new URLSearchParams();
    if (planId) params.set('plan_id', planId);
    if (brandId) params.set('brand_id', brandId);
    if (paidMedia) params.set('paid_media', paidMedia);
    if (customerType) params.set('customer_type', customerType);
    if (returnTo && returnTo !== '/select-brand') params.set('return_to', returnTo);
    if (portal?.subdomain) params.set('portal', portal.subdomain);
    const query = params.toString();
    return query ? `${redirectOrigin}/franchisee-auth?${query}` : `${redirectOrigin}/franchisee-auth`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      toast.error('You are offline. Please check your connection and try again.');
      return;
    }

    if (isLogin) {
      const validation = authSchema.safeParse({ email });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    } else {
      const validation = signupSchema.safeParse({ email, fullName });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      // Omit emailRedirectTo so Supabase uses Site URL (avoids 422 if custom URL isn't in allow list). User signs in by entering the code.
      if (isLogin) {
        const { error } = await signInWithOtp(email, {
          shouldCreateUser: false,
        });
        if (error) {
          if (error.message.includes('Signups not allowed') || error.message.includes('signups_disabled')) {
            toast.error('No account found for this email. Sign up to create an account.');
            setIsLogin(false);
          } else {
            toast.error(error.message);
          }
        } else {
          setCodeSent(true);
        }
      } else {
        let { error } = await signInWithOtp(email, {
          data: { full_name: fullName },
          shouldCreateUser: true,
        });
        // Fallback: if project disables OTP signup, create user with signUp then send OTP
        const otpSignupDisabled =
          error?.message?.includes('Signups not allowed for otp') ||
          (error as { code?: string })?.code === 'otp_disabled';
        if (error && otpSignupDisabled) {
          const tempPassword = `${Math.random().toString(36).slice(-10)}A1a!`;
          const { error: signUpError } = await signUp(email, tempPassword, { full_name: fullName });
          if (signUpError) {
            if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
              toast.error('An account with this email already exists. Use sign in to get a code.');
              setIsLogin(true);
            } else {
              toast.error(signUpError.message);
            }
            setLoading(false);
            return;
          }
          error = (await signInWithOtp(email, { shouldCreateUser: false })).error;
        }
        if (error && !otpSignupDisabled) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            toast.error('An account with this email already exists. Use sign in to get a code.');
            setIsLogin(true);
          } else {
            toast.error(error.message);
          }
        } else if (!error) {
          setCodeSent(true);
        } else {
          toast.error(error?.message ?? 'Could not send code. Try again.');
        }
      }
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
      // Success: onAuthStateChange will set user and useEffect will redirect
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (codeSent) {
    return (
      <PortalLayout
        showBackButton={false}
        infoBannerText="Sign in or create an account to access the franchise registration portal."
      >
        <div className="flex items-center justify-center py-8">
          <Card className="w-full max-w-md shadow-elevated animate-scale-in border border-border rounded-lg">
            <CardHeader className="text-center space-y-4 p-card-padding pb-0">
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
                    setIsLogin(true);
                  }}
                  disabled={loading}
                >
                  Back to Sign in
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Didn&apos;t get the code? Check spam or request a new one below.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      showBackButton={false}
      infoBannerText="Sign in or create an account to access the franchise registration portal."
    >
      <div className="flex items-center justify-center py-8">
        <Card className="w-full max-w-md shadow-elevated animate-scale-in border border-border rounded-lg">
          <CardHeader className="text-center space-y-4 p-card-padding pb-0">
            <div>
              <CardTitle className="text-page-title text-foreground">
                {isLogin ? 'Sign in to continue' : 'Create your account'}
              </CardTitle>
              <CardDescription className="text-body text-muted-foreground mt-2">
                {isLogin 
                  ? 'Sign in to your account to complete your registration' 
                  : 'Create an account to save your progress and manage your subscription'
                }
              </CardDescription>
            </div>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 p-card-padding">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-body-medium text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-11 rounded-md border-border"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

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
                  <span>You're offline. Sign in will work when you're back online.</span>
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
                    {isLogin ? 'Sign in' : 'Sign up'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-body text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PortalLayout>
  );
}
