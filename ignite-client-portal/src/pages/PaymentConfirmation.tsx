import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const POLL_INTERVAL = 2000; // Poll every 2 seconds
const MAX_POLL_TIME = 60000; // Max 60 seconds of polling

export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const franchiseeId = searchParams.get('franchisee_id');
  const sessionId = searchParams.get('session_id');
  
  const [status, setStatus] = useState<'polling' | 'confirmed' | 'timeout' | 'error'>('polling');
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!franchiseeId) {
      toast.error('Missing franchisee information');
      navigate('/');
      return;
    }

    let pollCount = 0;
    const startTime = Date.now();

    const pollPaymentStatus = async () => {
      try {
        const { data: franchisee, error } = await supabase
          .from('franchisees')
          .select('payment_status, onboarding_step')
          .eq('id', franchiseeId)
          .single();

        if (error) {
          console.error('Error fetching franchisee:', error);
          setStatus('error');
          return;
        }

        const elapsed = Date.now() - startTime;
        setElapsedTime(elapsed);

        // Check if payment was confirmed by webhook
        const confirmedStatuses = ['authorized', 'paid', 'trialing'];
        if (franchisee?.payment_status && confirmedStatuses.includes(franchisee.payment_status)) {
          setStatus('confirmed');
          toast.success('Payment confirmed!');
          
          // Wait a moment to show success state, then redirect
          setTimeout(() => {
            navigate(`/onboarding?franchisee_id=${franchiseeId}`);
          }, 1500);
          return;
        }

        // Check for timeout
        if (elapsed >= MAX_POLL_TIME) {
          setStatus('timeout');
          return;
        }

        // Continue polling
        pollCount++;
        setTimeout(pollPaymentStatus, POLL_INTERVAL);
      } catch (err) {
        console.error('Polling error:', err);
        setStatus('error');
      }
    };

    // Start polling
    pollPaymentStatus();

    // Cleanup on unmount
    return () => {
      pollCount = MAX_POLL_TIME; // Stop polling
    };
  }, [franchiseeId, navigate]);

  const handleContinueAnyway = () => {
    // User chose to continue without confirmation - redirect to onboarding
    navigate(`/onboarding?franchisee_id=${franchiseeId}`);
  };

  const handleRetry = () => {
    setStatus('polling');
    setElapsedTime(0);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          {status === 'polling' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Confirming Your Payment</h2>
              <p className="text-muted-foreground">
                Please wait while we verify your payment with Stripe...
              </p>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${Math.min((elapsedTime / MAX_POLL_TIME) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This usually takes a few seconds
              </p>
            </div>
          )}

          {status === 'confirmed' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Payment Confirmed!</h2>
              <p className="text-muted-foreground">
                Redirecting you to complete your onboarding...
              </p>
            </div>
          )}

          {status === 'timeout' && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-accent-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Taking Longer Than Expected</h2>
              <p className="text-muted-foreground">
                We haven't received payment confirmation yet. This can sometimes take a minute.
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <Button onClick={handleRetry} variant="outline">
                  Check Again
                </Button>
                <Button onClick={handleContinueAnyway}>
                  Continue to Onboarding
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Don't worry - your payment was processed. You can continue while we confirm in the background.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Something Went Wrong</h2>
              <p className="text-muted-foreground">
                We couldn't verify your payment status. Please try again.
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <Button onClick={handleRetry}>
                  Try Again
                </Button>
                <Button onClick={handleContinueAnyway} variant="outline">
                  Continue Anyway
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
