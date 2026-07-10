import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const DEFAULT_PLAN_CATEGORY = 'Other';

type SelectedPlanMap = Record<string, string>;
type PaidMediaMap = Record<string, boolean>;

type SelectablePlan = {
  id: string;
  name: string;
  category?: string | null;
  monthly_price: number;
  monthly_price_with_media?: number | null;
  supports_paid_media?: boolean | null;
  requires_paid_media?: boolean | null;
  stripe_price_id_with_media?: string | null;
};

const getPlanCategory = (plan: SelectablePlan) => plan.category || DEFAULT_PLAN_CATEGORY;

type PlanCategoryGroup = {
  category: string;
  plans: SelectablePlan[];
};

export default function SelectPlan() {
  const { portal } = usePortal();
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get('brand_id');
  const portalParam = searchParams.get('portal');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanIdsByCategory, setSelectedPlanIdsByCategory] = useState<SelectedPlanMap>({});
  const [includePaidMedia, setIncludePaidMedia] = useState(false);
  const [includePaidMediaByCategory, setIncludePaidMediaByCategory] = useState<PaidMediaMap>({});
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
        .select('id, name, logo_url, existing_customer_logic, multi_plan_logic')
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

  const isMultiPlanLogicEnabled = brand?.multi_plan_logic === true;

  const planGroups = useMemo<PlanCategoryGroup[]>(() => {
    if (!plans) return [];

    return plans.reduce<PlanCategoryGroup[]>((groups, plan) => {
      const category = getPlanCategory(plan);
      const existingGroup = groups.find((group) => group.category === category);

      if (existingGroup) {
        existingGroup.plans.push(plan);
      } else {
        groups.push({ category, plans: [plan] });
      }

      return groups;
    }, []);
  }, [plans]);

  const selectedPlans = useMemo(() => {
    if (!plans) return [];

    if (!isMultiPlanLogicEnabled) {
      const plan = plans.find((p) => p.id === selectedPlanId);
      return plan ? [plan] : [];
    }

    return planGroups
      .map((group) => plans.find((plan) => plan.id === selectedPlanIdsByCategory[group.category]))
      .filter((plan): plan is SelectablePlan => Boolean(plan));
  }, [isMultiPlanLogicEnabled, planGroups, plans, selectedPlanId, selectedPlanIdsByCategory]);

  const selectedPlan = selectedPlans[0] ?? null;

  // Reset paid media when single-plan selection changes (auto-enable if required)
  useEffect(() => {
    if (isMultiPlanLogicEnabled) return;

    const plan = plans?.find(p => p.id === selectedPlanId);
    if (plan?.requires_paid_media) {
      setIncludePaidMedia(true);
    } else {
      setIncludePaidMedia(false);
    }
    setConfirmationChecked(false);
  }, [isMultiPlanLogicEnabled, selectedPlanId, plans]);

  // Keep one paid-media flag per selected category in multi-plan mode.
  useEffect(() => {
    if (!isMultiPlanLogicEnabled || !plans) return;

    setIncludePaidMediaByCategory((current) => {
      const next: PaidMediaMap = {};

      Object.entries(selectedPlanIdsByCategory).forEach(([category, planId]) => {
        const plan = plans.find((p) => p.id === planId);
        next[category] = plan?.requires_paid_media ? true : current[category] ?? false;
      });

      return next;
    });
    setConfirmationChecked(false);
  }, [isMultiPlanLogicEnabled, plans, selectedPlanIdsByCategory]);

  const isLoading = brandLoading || plansLoading;
  const brandAllowsExistingCustomers = brand?.existing_customer_logic === true;
  const effectiveCustomerType = brandAllowsExistingCustomers ? 'existing' : 'new';

  const canSelectPaidMedia = (plan: { supports_paid_media?: boolean | null; stripe_price_id_with_media?: string | null }) => {
    // Allow paid media if plan has Stripe price configured
    // monthly_price_with_media is optional for display purposes
    return !!(
      plan?.supports_paid_media &&
      plan?.stripe_price_id_with_media
    );
  };

  const getIncludesPaidMedia = (plan: SelectablePlan) => {
    if (!isMultiPlanLogicEnabled) {
      return includePaidMedia;
    }

    return includePaidMediaByCategory[getPlanCategory(plan)] ?? false;
  };

  const setIncludesPaidMedia = (plan: SelectablePlan, checked: boolean) => {
    if (!isMultiPlanLogicEnabled) {
      setIncludePaidMedia(checked);
      return;
    }

    const category = getPlanCategory(plan);
    setIncludePaidMediaByCategory((current) => ({ ...current, [category]: checked }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPlanMonthlyInvestment = (plan: SelectablePlan) => {
    return getIncludesPaidMedia(plan) && canSelectPaidMedia(plan)
      ? plan.monthly_price + (plan.monthly_price_with_media || 0)
      : plan.monthly_price;
  };

  const handlePlanSelect = (plan: SelectablePlan) => {
    if (!isMultiPlanLogicEnabled) {
      setSelectedPlanId(plan.id);
      return;
    }

    const category = getPlanCategory(plan);
    setSelectedPlanIdsByCategory((current) => {
      const next = { ...current };

      if (next[category] === plan.id) {
        delete next[category];
        return next;
      }

      next[category] = plan.id;
      return next;
    });
  };

  const persistFranchiseePlans = async (franchiseeId: string) => {
    const selections = selectedPlans.map((plan, index) => ({
      franchisee_id: franchiseeId,
      plan_id: plan.id,
      category: getPlanCategory(plan),
      is_primary: index === 0,
    }));

    const { error: deleteError } = await supabase
      .from('franchisee_plans')
      .delete()
      .eq('franchisee_id', franchiseeId);

    if (deleteError) throw deleteError;

    if (selections.length === 0) return;

    const { error: insertError } = await supabase
      .from('franchisee_plans')
      .insert(selections);

    if (insertError) throw insertError;
  };

  const handleSelectPackage = async () => {
    if (!confirmationChecked) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      toast.error('Please confirm your selections before proceeding');
      return;
    }

    if (!selectedPlan || selectedPlans.length === 0 || !brandId) {
      toast.error(isMultiPlanLogicEnabled ? 'Please select at least one plan' : 'Please select a plan');
      return;
    }

    if (!user?.id || !user?.email) {
      toast.error('You must be logged in to proceed. Please refresh and try again.');
      return;
    }

    const invalidPaidMediaPlan = selectedPlans.find((plan) => getIncludesPaidMedia(plan) && !canSelectPaidMedia(plan));
    if (invalidPaidMediaPlan) {
      toast.error(`Paid media pricing is not configured for ${invalidPaidMediaPlan.name}. Please choose another plan or continue without paid media.`);
      return;
    }

    // User is already logged in at this point (route is protected), create franchisee record and proceed to payment
    setIsSubmitting(true);

    try {
      // For contract-only portals (no payment required), go directly to onboarding.
      // No lock-in until contract is submitted, so users can freely change plans.
      // Default to requiring payment if no portal context (safer behavior)
      const requiresPayment = portal?.require_payment !== false;

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

      // Check for an existing editable incomplete record for this user + brand before creating a new one.
      // Do not filter by plan_id: users may go back from payment processing, change their plan,
      // and then continue with the same pending franchisee registration. Reusing that record keeps
      // /payment-processing?franchisee_id=... pointed at the current selections instead of an older stub.
      const { data: existing } = await supabase
        .from('franchisees')
        .select('id')
        .eq('user_id', user.id)
        .eq('brand_id', brandId)
        .eq('status', 'pending')
        .eq('name', 'Pending Registration')
        .in('payment_status', ['pending', 'pending_checkout'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const usesExistingCustomerBypass = effectiveCustomerType === 'existing' && brandAllowsExistingCustomers;
      const includesAnyPaidMedia = selectedPlans.some((plan) => getIncludesPaidMedia(plan));
      const franchiseeStatus = usesExistingCustomerBypass
        ? {
            include_paid_media: includesAnyPaidMedia,
            service_start_date: '2026-01-01',
            payment_status: 'authorized',
            onboarding_step: 'intake',
            customer_type: effectiveCustomerType,
          }
        : requiresPayment
          ? {
              include_paid_media: includesAnyPaidMedia,
              service_start_date: null,
              payment_status: 'pending',
              onboarding_step: 'payment',
              customer_type: effectiveCustomerType,
            }
          : {
              include_paid_media: includesAnyPaidMedia,
              service_start_date: null,
              payment_status: null,
              onboarding_step: 'intake',
              customer_type: effectiveCustomerType,
            };

      let franchiseeId: string;

      if (existing) {
        // Reuse the existing stub — update selections in case they changed
        const { error } = await supabase
          .from('franchisees')
          .update({
            plan_id: selectedPlan.id,
            ...franchiseeStatus,
          })
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

      await persistFranchiseePlans(franchiseeId);

      // Save for localStorage fallback too
      savePendingOnboarding(
        franchiseeId,
        brandId,
        selectedPlan.id,
        selectedPlans.map((plan) => plan.id),
      );

      await queryClient.invalidateQueries({ queryKey: ['franchisee-payment', franchiseeId] });
      await queryClient.invalidateQueries({ queryKey: ['franchisee-selected-plans', franchiseeId] });

      if (usesExistingCustomerBypass || !requiresPayment) {
        navigate(`/onboarding?franchisee_id=${franchiseeId}`);
        return;
      }

      // Navigate to payment processing with a cache-busting selection version so returning
      // and changing plans cannot render stale React Query data for the same franchisee.
      const paymentParams = new URLSearchParams({
        franchisee_id: franchiseeId,
        selection_version: Date.now().toString(),
      });
      navigate(`/payment-processing?${paymentParams.toString()}`);
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
              {isMultiPlanLogicEnabled
                ? 'Choose up to one plan from each category, with at least one plan selected overall.'
                : 'Choose the plan that best fits your business goals and budget.'}
            </p>
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
              {isMultiPlanLogicEnabled ? (
                <div className="space-y-10 mb-8">
                  {planGroups.map((group, groupIndex) => (
                    <section key={group.category} className="space-y-4">
                      <div className="flex flex-col gap-1 border-b border-border pb-3">
                        <p className="text-label text-primary uppercase">Category {groupIndex + 1}</p>
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                          <h2 className="text-section-header text-foreground">{group.category}</h2>
                          <p className="text-sm text-muted-foreground">Select up to one plan from this category</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {group.plans.map((plan, planIndex) => {
                          const isSelected = selectedPlanIdsByCategory[group.category] === plan.id;

                          return (
                            <div
                              key={plan.id}
                              className="animate-slide-up"
                              style={{ animationDelay: `${(groupIndex + planIndex) * 0.1}s` }}
                            >
                              <PlanCard
                                plan={plan}
                                isSelected={isSelected}
                                includePaidMedia={isSelected ? getIncludesPaidMedia(plan) : false}
                                onSelect={() => handlePlanSelect(plan)}
                                onTogglePaidMedia={(checked) => setIncludesPaidMedia(plan, checked)}
                                formatPrice={formatPrice}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {plans.map((plan, index) => {
                    const isSelected = selectedPlanId === plan.id;

                    return (
                      <div
                        key={plan.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <PlanCard
                          plan={plan}
                          isSelected={isSelected}
                          includePaidMedia={isSelected ? getIncludesPaidMedia(plan) : false}
                          onSelect={() => handlePlanSelect(plan)}
                          onTogglePaidMedia={(checked) => setIncludesPaidMedia(plan, checked)}
                          formatPrice={formatPrice}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Section - Confirmation */}
              {selectedPlans.length > 0 && selectedPlan && (
                <div className="bg-card border border-border rounded-lg p-4 sm:p-6 md:p-card-padding shadow-card animate-scale-in">
                  {/* Summary */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div>
                      <p className="text-label text-muted-foreground mb-3">
                        {isMultiPlanLogicEnabled ? 'Selected Packages' : 'Selected Package'}
                      </p>
                      <div className="space-y-3">
                        {selectedPlans.map((plan) => {
                          const category = getPlanCategory(plan);
                          const planIncludesPaidMedia = getIncludesPaidMedia(plan);

                          return (
                            <div key={plan.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-muted/30 p-3">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">{category}</p>
                                <p className="text-section-header text-foreground">
                                  {plan.name}
                                  {planIncludesPaidMedia && plan.supports_paid_media && (
                                    <span className="text-primary"> + Paid Media</span>
                                  )}
                                </p>
                              </div>
                              <div className="sm:text-right">
                                <p className="text-sm text-muted-foreground">Monthly Investment</p>
                                <p className="text-card-headline text-foreground">
                                  {formatPrice(getPlanMonthlyInvestment(plan))}
                                  <span className="text-body font-normal text-muted-foreground">/mo</span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
