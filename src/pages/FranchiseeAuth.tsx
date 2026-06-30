import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePortal } from '@/contexts/PortalContext';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Mail, ArrowRight, Loader2, WifiOff, User, Lock } from 'lucide-react';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = authSchema.extend({
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

  // Redirect if already logged in
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      toast.error('You are offline. Please check your connection and try again.');
      return;
    }

    if (isLogin) {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    } else {
      const validation = signupSchema.safeParse({ email, fullName, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message || 'Invalid email or password. Please try again.');
        } else {
          toast.success('Signed in.');
        }
      } else {
        const { error } = await signUp(email, password, { full_name: fullName });
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            toast.error('An account with this email already exists. Use sign in.');
            setIsLogin(true);
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Registration successful. Please check your email to confirm your account.');
          setIsLogin(true);
        }
      }
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-body-medium text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              
              <div className="flex flex-col gap-2 w-full text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading || !isOnline}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PortalLayout>
  );
}
