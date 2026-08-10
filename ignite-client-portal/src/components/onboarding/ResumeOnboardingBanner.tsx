import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useOnboardingResume } from '@/hooks/useOnboardingResume';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, X, AlertCircle, Loader2 } from 'lucide-react';

interface ResumeOnboardingBannerProps {
  className?: string;
}

const CONFIRMED_PAYMENT_STATUSES = ['paid', 'authorized', 'trialing'];

export function ResumeOnboardingBanner({ className }: ResumeOnboardingBannerProps) {
  const navigate = useNavigate();
  const { hasResume, resumeData, isLoading, clearResume, canCancelAndSwitch, cancelAndSwitch } = useOnboardingResume();
  const [isCancelling, setIsCancelling] = useState(false);

  if (isLoading || !hasResume || !resumeData) {
    return null;
  }

  const hasPaid = CONFIRMED_PAYMENT_STATUSES.includes(resumeData.paymentStatus ?? '');

  const getStepLabel = (step: string) => {
    // If payment isn't confirmed yet, always show "Complete Payment" regardless of stored step
    if (!hasPaid) return 'Complete Payment';
    switch (step) {
      case 'payment':
        return 'Complete Payment';
      case 'intake':
        return 'Business Information';
      case 'representatives':
        return 'Representative Details';
      case 'contract':
        return 'Contract Review';
      default:
        return 'Registration';
    }
  };

  const handleCancelAndSwitch = async () => {
    setIsCancelling(true);
    const result = await cancelAndSwitch();
    setIsCancelling(false);
    if (result?.error) {
      toast.error(result.error);
    }
  };

  return (
    <Card className={`border-primary bg-primary/5 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              Resume Your Registration
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              You have an incomplete registration for <span className="font-medium">{resumeData.planName}</span>
              {' '}with <span className="font-medium">{resumeData.brandName}</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Next step: {getStepLabel(resumeData.onboardingStep)}
            </p>
            {canCancelAndSwitch && (
              <button
                onClick={handleCancelAndSwitch}
                disabled={isCancelling}
                className="text-xs text-muted-foreground underline underline-offset-2 mt-2 hover:text-foreground disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel and choose a different plan'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearResume}
              className="h-8 w-8"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(resumeData.resumeUrl)}
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
