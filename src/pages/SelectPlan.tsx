import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { useUser } from '@/contexts/UserContext';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PortalGate } from '@/components/PortalGate';
import { PlanCard } from '@/components/plans/PlanCard';
import { PlanCardSkeleton } from '@/components/plans/PlanCardSkeleton';
import { ResumeOnboardingBanner } from '@/components/onboarding/ResumeOnboardingBanner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { savePendingOnboarding } from '@/hooks/useOnboardingResume';

export default function SelectPlan() {
  const { portal } = usePortal();
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get('brand_id');
  const portalParam = searchParams.get('portal');
  const initialCustomerType = searchParams.get('customer_type') === 'existing' ? 'existing' : 'new';
  const [selectedCustomerType, setSelectedCustomerType] = useState<'new' | 'existing'>(initialCustomerType);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [includePaidMedia, setIncludePaidMedia] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build back URL preserving portal param
  const backParams = new URLSearchParams();
  if (portalParam) backParams.set('portal', portalParam);
  const backQuery = backParams.toString();
  const backUrl = backQuery ? `/select-brand?${backQuery}` : '/select-brand';

  // Redirect if no brand_id
  useEffect(() => {
    if (!brandId) {
      navigate(backUrl, { replace: true });
    }
  }, [brandId, navigate, backUrl]);


  // Fetch brand details
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, logo_url, existing_customer_logic')
        .eq('id', brandId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Fetch plans for brand
  const { data: plans, isLoading: plansLoading, error } = useQuery({
    queryKey: ['brand-plans', brandId, 'active'],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('brand_id', brandId)
        .eq('status', 'active')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Reset paid media when plan changes (auto-enable if required)
  useEffect(() => {
    const plan = plans?.find(p => p.id === selectedPlanId);
    if (plan?.requires_paid_media) {
      setIncludePaidMedia(true);
    } else {
      setIncludePaidMedia(false);
    }
    setConfirmationChecked(false);
  }, [selectedPlanId, plans]);

  const isLoading = brandLoading || plansLoading;
  const selectedPlan = plans?.find(p => p.id === selectedPlanId);
  const brandAllowsExistingCustomers = brand?.existing_customer_logic === true;
  const effectiveCustomerType = brandAllowsExistingCustomers ? selectedCustomerType : 'new';

  const handleCustomerTypeChange = (value: 'new' | 'existing') => {
    setSelectedCustomerType(value);
    const params = new URLSearchParams(searchParams);
    params.set('customer_type', value);
    navigate(`/select-plan?${params.toString()}`, { replace: true });
  };

  const canSelectPaidMedia = (plan: { supports_paid_media?: boolean | null; stripe_price_id_with_media?: string | null }) => {
    // Allow paid media if plan has Stripe price configured
    // monthly_price_with_media is optional for display purposes
    return !!(
      plan?.supports_paid_media &&
      plan?.stripe_price_id_with_media
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleSelectPackage = async () => {
    if (!confirmationChecked) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      toast.error('Please confirm your selections before proceeding');
      return;
    }

    if (!selectedPlan || !brandId) {
      toast.error('Please select a plan');
      return;
    }

    if (!user?.id || !user?.email) {
      toast.error('You must be logged in to proceed. Please refresh and try again.');
      return;
    }

    if (includePaidMedia && !canSelectPaidMedia(selectedPlan)) {
      toast.error('Paid media pricing is not configured for this plan. Please choose another plan or continue without paid media.');
      return;
    }

    // User is already logged in at this point (route is protected), create franchisee record and proceed to payment
    setIsSubmitting(true);

    try {
      // For contract-only portals (no payment required), go directly to onboarding.
      // No lock-in until contract is submitted, so users can freely change plans.
      // Default to requiring payment if no portal context (safer behavior)
      const requiresPayment = portal?.require_payment !== false;

      if (!requiresPayment) {
        const params = new URLSearchParams({
          plan_id: selectedPlan.id,
          paid_media: String(includePaidMedia),
          customer_type: effectiveCustomerType,
        });
        navigate(`/onboarding?${params.toString()}`);
        return;
      }

      // Payment portals: block new signup if the user already has a paid/in-progress registration
      // for this brand that hasn't fully completed yet.
      // Users can sign up again once status reaches completed/active/inactive/cancelled.
      const { data: inProgress } = await supabase
        .from('franchisees')
        .select('id, name, onboarding_step')
        .eq('user_id', user.id)
        .eq('brand_id', brandId)
        .in('payment_status', ['pending_checkout', 'authorized', 'trialing', 'paid', 'past_due'])
        .not('status', 'in', '("completed","active","inactive","cancelled","contract_signed","awaiting_countersign")')
        .limit(1)
        .maybeSingle();

      if (inProgress) {
        toast.error('You already have a registration in progress for this brand. Please complete your current signup before starting a new one.');
        setIsSubmitting(false);
        return;
      }

      // Check for an existing incomplete record for this user + brand + plan before creating a new one.
      // This prevents duplicate "Pending Registration" rows when a user abandons checkout and returns.
      const { data: existing } = await supabase
        .from('franchisees')
        .select('id')
        .eq('user_id', user.id)
        .eq('brand_id', brandId)
        .eq('plan_id', selectedPlan.id)
        .eq('status', 'pending')
        .eq('name', 'Pending Registration')
        .in('payment_status', ['pending', 'pending_checkout'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const usesExistingCustomerBypass = effectiveCustomerType === 'existing' && brandAllowsExistingCustomers;
      const franchiseeStatus = usesExistingCustomerBypass
        ? {
            include_paid_media: includePaidMedia,
            service_start_date: '2026-01-01',
            payment_status: 'authorized',
            onboarding_step: 'intake',
          }
        : {
            include_paid_media: includePaidMedia,
            service_start_date: null,
            payment_status: 'pending',
            onboarding_step: 'payment',
          };

      let franchiseeId: string;

      if (existing) {
        // Reuse the existing stub — update selections in case they changed
        const { error } = await supabase
          .from('franchisees')
          .update(franchiseeStatus)
          .eq('id', existing.id);
        if (error) throw error;
        franchiseeId = existing.id;
      } else {
        // Create a fresh stub record
        const { data: franchisee, error } = await supabase
          .from('franchisees')
          .insert({
            user_id: user.id,
            brand_id: brandId,
            plan_id: selectedPlan.id,
            name: 'Pending Registration',
            email: user.email,
            status: 'pending',
            ...franchiseeStatus,
          })
          .select('id')
          .single();

        if (error) throw error;
        franchiseeId = franchisee.id;
      }

      // Save for localStorage fallback too
      savePendingOnboarding(franchiseeId, brandId, selectedPlan.id);

      if (usesExistingCustomerBypass) {
        navigate(`/onboarding?franchisee_id=${franchiseeId}`);
        return;
      }

      // Navigate to payment processing with the franchisee ID
      navigate(`/payment-processing?franchisee_id=${franchiseeId}`);
    } catch (error: unknown) {
      console.error('Error creating franchisee:', error);
      toast.error('Failed to proceed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalGate>
      <PortalLayout 
        showBackButton={true}
        backTo={backUrl}
        backLabel="Back"
        infoBannerText="Review each package carefully. All plans include dedicated support and monthly performance reporting."
      >
        <div className="animate-fade-in">
          {/* Resume Banner */}
          <ResumeOnboardingBanner className="mb-6" />

          {/* Header */}
          <div className="text-center mb-10">
            {brand && (
              <p className="text-label text-primary mb-3 uppercase">
                {brand.name}
              </p>
            )}
            <h1 className="text-page-title text-foreground mb-3">
              Select Your Marketing Package
            </h1>
            <p className="text-body text-muted-foreground max-w-xl mx-auto">
              Choose the plan that best fits your business goals and budget.
            </p>
            {brandAllowsExistingCustomers && (
              <div className="mt-6 max-w-xl mx-auto rounded-lg border bg-card p-4 shadow-card">
                <p className="text-label text-muted-foreground mb-3 uppercase">Are you a New or Existing Customer?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'new' as const, label: 'New Customer' },
                    { value: 'existing' as const, label: 'Existing Customer' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selectedCustomerType === option.value ? 'default' : 'outline'}
                      className="h-auto justify-center p-4"
                      onClick={() => handleCustomerTypeChange(option.value)}
                    >
                      <span className="font-semibold">{option.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <PlanCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-section-header text-foreground mb-2">
                Unable to Load Plans
              </h2>
              <p className="text-body text-muted-foreground">
                Please try refreshing the page.
              </p>
            </div>
          )}

          {/* Zero Plans State */}
          {!isLoading && !error && plans?.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-section-header text-foreground mb-2">
                No Plans Available
              </h2>
              <p className="text-body text-muted-foreground max-w-md mx-auto">
                No plans are currently available for this brand. Please contact support for assistance.
              </p>
            </div>
          )}

          {/* Plans Grid */}
          {!isLoading && !error && plans && plans.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {plans.map((plan, index) => (
                  <div 
                    key={plan.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <PlanCard
                      plan={plan}
                      isSelected={selectedPlanId === plan.id}
                      includePaidMedia={selectedPlanId === plan.id ? includePaidMedia : false}
                      onSelect={() => setSelectedPlanId(plan.id)}
                      onTogglePaidMedia={(checked) => setIncludePaidMedia(checked)}
                      formatPrice={formatPrice}
                    />
                  </div>
                ))}
              </div>

              {/* Bottom Section - Confirmation */}
              {selectedPlanId && selectedPlan && (
                <div className="bg-card border border-border rounded-lg p-4 sm:p-6 md:p-card-padding shadow-card animate-scale-in">
                  {/* Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <p className="text-label text-muted-foreground mb-1">Selected Package</p>
                      <p className="text-section-header text-foreground">
                        {selectedPlan.name}
                        {includePaidMedia && selectedPlan.supports_paid_media && (
                          <span className="text-primary"> + Paid Media</span>
                        )}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-label text-muted-foreground mb-1">Monthly Investment</p>
                      <p className="text-card-headline text-foreground">
                        {includePaidMedia && canSelectPaidMedia(selectedPlan)
                          ? formatPrice(selectedPlan.monthly_price + (selectedPlan.monthly_price_with_media || 0))
                          : formatPrice(selectedPlan.monthly_price)
                        }
                        <span className="text-body font-normal text-muted-foreground">/mo</span>
                      </p>
                    </div>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                    <Checkbox
                      id="confirmation"
                      checked={confirmationChecked}
                      onCheckedChange={(checked) => setConfirmationChecked(checked === true)}
                      className="mt-0.5"
                      aria-describedby="confirmation-description"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="confirmation"
                        className="text-body-medium cursor-pointer"
                      >
                        I confirm all selections above are accurate
                      </Label>
                      <p id="confirmation-description" className="text-sm text-muted-foreground">
                        By checking this box, you acknowledge that you have reviewed and agree to the selected package and options.
                      </p>
                    </div>
                  </div>

                  {/* Select Package Button */}
                  <Button
                    type="button"
                    size="lg"
                    className={cn(
                      'w-full h-12 text-base font-semibold rounded-md transition-all duration-300',
                      !confirmationChecked && 'opacity-50 cursor-not-allowed',
                      isShaking && 'animate-shake'
                    )}
                    onPointerDown={(e) => {
                      // Some fixed/animated layers can swallow click; pointerdown is more reliable.
                      e.preventDefault();
                      e.stopPropagation();
                      void handleSelectPackage();
                    }}
                    disabled={!confirmationChecked || isSubmitting}
                    aria-disabled={!confirmationChecked || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      effectiveCustomerType === 'existing' && brandAllowsExistingCustomers ? 'Continue to Onboarding' : portal?.require_payment ? 'Proceed to Payment' : 'Select Package'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </PortalLayout>
    </PortalGate>
  );
}
