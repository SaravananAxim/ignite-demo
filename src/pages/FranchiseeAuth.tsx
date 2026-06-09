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
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Mail, Lock, ArrowRight, Loader2, WifiOff, User } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Please enter your full name'),
});

export default function FranchiseeAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, resetPassword, user } = useUser();
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

    setLoading(true);
    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            toast.error('Incorrect email or password.');
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            toast.error('Please confirm your email before signing in. Check your inbox for the confirmation link.');
          } else {
            toast.error(error.message);
          }
          return;
        }
        // Success: onAuthStateChange sets user and the effect redirects.
      } else {
        const validation = signupSchema.safeParse({ email, password, fullName });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          return;
        }

        const { error } = await signUp(
          email,
          password,
          { full_name: fullName },
          getEmailRedirectTo(),
        );
        if (error) {
          if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
            toast.error('An account with this email already exists. Sign in instead.');
            setIsLogin(true);
          } else {
            toast.error(error.message);
          }
          return;
        }
        // If email confirmation is required, no session is created yet. If it is
        // disabled, onAuthStateChange signs the user in and the effect redirects.
        toast.success('Account created. Check your email to confirm, then sign in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const validation = z.string().email().safeParse(email);
    if (!validation.success) {
      toast.error('Enter your email above, then select "Forgot password".');
      return;
    }
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('If an account exists for that email, a reset link is on its way.');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
                      autoComplete="name"
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
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-body-medium text-foreground">Password</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-md border-border"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    minLength={isLogin ? undefined : 6}
                    required
                  />
                </div>
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                )}
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
                onClick={() => {
                  setIsLogin(!isLogin);
                  setPassword('');
                }}
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
