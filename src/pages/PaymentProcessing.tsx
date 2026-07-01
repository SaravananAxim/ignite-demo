import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { EffectiveDateSelector } from "@/components/payment/EffectiveDateSelector";
import { format } from "date-fns";
import { savePendingOnboarding } from "@/hooks/useOnboardingResume";

const DEFAULT_PLAN_CATEGORY = "Other";

type PaymentPlan = {
  id: string;
  name: string;
  category?: string | null;
  monthly_price?: number | null;
  monthly_price_with_media?: number | null;
  setup_fee?: number | null;
};

type SelectedPaymentPlan = {
  plan: PaymentPlan;
  category: string;
  isPrimary: boolean;
};

const EMPTY_SELECTED_PLANS: SelectedPaymentPlan[] = [];

export default function PaymentProcessing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const franchiseeId = searchParams.get("franchisee_id");
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const customerType = searchParams.get("customer_type") === "existing" ? "existing" : "new";
  const selectionVersion = searchParams.get("selection_version");
  
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);
  const [isBypassingExistingCustomer, setIsBypassingExistingCustomer] = useState(false);

  // Fetch franchisee details (include portal for effective-date settings)
  const { data: franchisee, isLoading } = useQuery({
    queryKey: ["franchisee-payment", franchiseeId, selectionVersion],
    queryFn: async () => {
      if (!franchiseeId) return null;
      const { data, error } = await supabase
        .from("franchisees")
        .select("*, brands(*, portals(*)), plans(*)")
        .eq("id", franchiseeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!franchiseeId,
    refetchOnMount: "always",
  });

  const isMultiPlanLogicEnabled = franchisee?.brands?.multi_plan_logic === true;

  // Fetch persisted selected plans for multi-plan brands. Checkout still derives
  // selected plans server-side by franchiseeId for integrity; this query is for
  // displaying an accurate client-side summary and resume metadata.
  const { data: persistedSelectedPlans = EMPTY_SELECTED_PLANS, isLoading: selectedPlansLoading } = useQuery({
    queryKey: ["franchisee-selected-plans", franchiseeId, selectionVersion],
    queryFn: async () => {
      if (!franchiseeId) return [];

      const { data, error } = await supabase
        .from("franchisee_plans")
        .select("category, is_primary, plans(id, name, category, monthly_price, monthly_price_with_media, setup_fee)")
        .eq("franchisee_id", franchiseeId)
        .order("is_primary", { ascending: false })
        .order("category", { ascending: true });

      if (error) throw error;

      return (data || [])
        .filter((selection) => !!selection.plans)
        .map((selection) => ({
          plan: selection.plans as PaymentPlan,
          category: selection.category || (selection.plans as PaymentPlan).category || DEFAULT_PLAN_CATEGORY,
          isPrimary: selection.is_primary === true,
        }));
    },
    enabled: !!franchiseeId && isMultiPlanLogicEnabled,
    refetchOnMount: "always",
  });

  const selectedPlans = useMemo<SelectedPaymentPlan[]>(() => {
    if (isMultiPlanLogicEnabled) {
      return persistedSelectedPlans;
    }

    const plan = franchisee?.plans as PaymentPlan | null | undefined;
    return plan
      ? [{ plan, category: plan.category || DEFAULT_PLAN_CATEGORY, isPrimary: true }]
      : [];
  }, [franchisee?.plans, isMultiPlanLogicEnabled, persistedSelectedPlans]);

  const selectedPlanIds = useMemo(
    () => selectedPlans.map(({ plan }) => plan.id),
    [selectedPlans],
  );
  const selectedPlanIdsKey = selectedPlanIds.join(",");
  const hasSelectedPlans = selectedPlans.length > 0;

  // Handle success/cancel redirects
  useEffect(() => {
    if (success === "true") {
      toast.success("Payment setup successful!");
      navigate(`/confirmation?franchisee_id=${franchiseeId}`);
    } else if (canceled === "true") {
      toast.error("Payment was canceled. Please try again.");
    }
  }, [success, canceled, franchiseeId, navigate]);

  // Redirect if no franchisee ID
  useEffect(() => {
    if (!franchiseeId && !isLoading) {
      toast.error("Missing franchisee information");
      navigate("/select-brand");
    }
  }, [franchiseeId, isLoading, navigate]);

  // Existing customers on existing-customer-enabled plans bypass effective date selection and Stripe.
  useEffect(() => {
    if (!franchisee || success === "true" || isBypassingExistingCustomer) return;

    const shouldBypassStripe =
      customerType === "existing" &&
      franchisee.brands?.existing_customer_logic === true;

    if (!shouldBypassStripe) return;

    const bypassStripe = async () => {
      setIsBypassingExistingCustomer(true);
      try {
        const { error } = await supabase
          .from("franchisees")
          .update({
            service_start_date: "2026-01-01",
            onboarding_step: "intake",
            payment_status: "authorized",
          })
          .eq("id", franchisee.id);

        if (error) throw error;

        savePendingOnboarding(
          franchisee.id,
          franchisee.brand_id,
          franchisee.plan_id,
          selectedPlanIdsKey ? selectedPlanIdsKey.split(",") : [],
        );
        navigate(`/onboarding?franchisee_id=${franchisee.id}`, { replace: true });
      } catch (error: unknown) {
        console.error("Error bypassing existing customer payment:", error);
        const message = error instanceof Error ? error.message : "Failed to continue to onboarding";
        toast.error(message);
        setIsBypassingExistingCustomer(false);
      }
    };

    void bypassStripe();
  }, [franchisee, success, isBypassingExistingCustomer, navigate, customerType, selectedPlanIdsKey]);

  const handleCreateCheckout = async () => {
    if (!franchisee || !effectiveDate) return;

    if (!hasSelectedPlans) {
      toast.error("No selected plans found. Please return to plan selection.");
      return;
    }

    setIsCreatingCheckout(true);

    try {
      const { error } = await supabase
        .from("franchisees")
        .update({
          payment_status: "paid",
          service_start_date: effectiveDate.toISOString().split("T")[0],
          onboarding_step: "intake",
        })
        .eq("id", franchisee.id);

      if (error) throw error;

      savePendingOnboarding(franchisee.id, franchisee.brand_id, franchisee.plan_id, selectedPlanIds);

      navigate(`/onboarding?franchisee_id=${franchisee.id}`, { replace: true });
    } catch (error: unknown) {
      console.error("Error processing checkout:", error);
      const message = error instanceof Error ? error.message : "Failed to process payment";
      toast.error(message);
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const handleBack = () => {
    // Go back to plan selection
    if (franchisee?.brand_id) {
      const params = new URLSearchParams({ brand_id: franchisee.brand_id });
      const portalParam = searchParams.get('portal');
      if (portalParam) params.set('portal', portalParam);
      if (customerType === 'existing') params.set('customer_type', customerType);
      navigate(`/select-plan?${params.toString()}`);
    } else {
      navigate('/select-brand');
    }
  };

  if (isLoading || selectedPlansLoading || isBypassingExistingCustomer) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  // Show success state if coming back from successful payment
  if (success === "true") {
    return (
      <PortalLayout>
        <div className="content-max px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Completing your setup...</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const setupFee = selectedPlans.reduce((total, { plan }) => total + (plan.setup_fee ? Number(plan.setup_fee) : 0), 0);
  const baseMonthly = selectedPlans.reduce((total, { plan }) => total + (plan.monthly_price ? Number(plan.monthly_price) : 0), 0);
  const mediaAddonAmount = selectedPlans.reduce((total, { plan }) => total + (plan.monthly_price_with_media ? Number(plan.monthly_price_with_media) : 0), 0);
  const showMedia = !!franchisee?.include_paid_media && !isMultiPlanLogicEnabled;
  // monthly_price_with_media is an ADD-ON amount in legacy single-plan flows,
  // so single-plan total = base + add-on. Multi-plan checkout charges each
  // persisted selected plan's own Stripe price server-side.
  const monthlyDue = showMedia && mediaAddonAmount > 0 ? baseMonthly + mediaAddonAmount : baseMonthly;

  return (
    <PortalLayout>
      <div className="content-max px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Hide back button once payment is confirmed — plan is locked in */}
          {!['paid', 'authorized', 'trialing'].includes(franchisee?.payment_status ?? '') && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Plan Selection
            </Button>
          )}
          
          <h1 className="text-page-title text-foreground mb-2">
            Complete Payment Setup
          </h1>
          <p className="text-body text-muted-foreground">
            Select your subscription start date and set up payment
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Date Selection & Payment */}
          <div className="space-y-6">
            {/* Effective Date Selection */}
            <EffectiveDateSelector
              selectedDate={effectiveDate}
              onSelect={setEffectiveDate}
              minDate={franchisee?.brands?.portals?.effective_date_min ?? undefined}
              optionCount={franchisee?.brands?.portals?.effective_date_option_count ?? undefined}
            />

            {/* Payment Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Information
                </CardTitle>
                <CardDescription>
                  {setupFee > 0 
                    ? `One-time setup fee of $${setupFee.toLocaleString()} will be charged today. Monthly subscription starts on your effective date.`
                    : "Your card will be saved and the monthly subscription will start on your effective date."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {canceled === "true" && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Payment Canceled</p>
                      <p className="text-sm text-muted-foreground">
                        Your payment setup was canceled. Please try again.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Plan selected and confirmed</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Secure payment via Stripe</span>
                    </div>
                    {effectiveDate && (
                      <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>Subscription starts {format(effectiveDate, 'MMMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleCreateCheckout}
                    disabled={isCreatingCheckout || !effectiveDate || !hasSelectedPlans}
                  >
                    {isCreatingCheckout ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : !hasSelectedPlans ? (
                      "No Plans Selected"
                    ) : !effectiveDate ? (
                      "Select an Effective Date to Continue"
                    ) : (
                      "Confirm & Continue"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <Card className="border-primary/20 bg-primary/5 h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Subscription Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {franchisee?.brands && (
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  {franchisee.brands.logo_url && (
                    <img
                      src={franchisee.brands.logo_url}
                      alt={franchisee.brands.name}
                      className="h-10 w-auto object-contain"
                    />
                  )}
                  <div>
                    <p className="font-medium">{franchisee.brands.name}</p>
                    <p className="text-sm text-muted-foreground">{franchisee.name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isMultiPlanLogicEnabled ? "Plans:" : "Plan:"}</span>
                    {!isMultiPlanLogicEnabled && (
                      <span className="font-medium">{selectedPlans[0]?.plan.name}</span>
                    )}
                  </div>
                  {isMultiPlanLogicEnabled && selectedPlans.map(({ plan, category }) => (
                    <div key={plan.id} className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{category}</span>
                      <span className="font-medium text-right">{plan.name}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Fee:</span>
                  <span className="font-bold text-lg">
                    ${monthlyDue.toLocaleString()}/mo
                  </span>
                </div>

                {showMedia && mediaAddonAmount > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Paid Media Add-on:</span>
                    <span className="font-medium text-primary">
                      +${mediaAddonAmount.toLocaleString()}/mo
                    </span>
                  </div>
                )}

                {setupFee > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">One-Time Setup Fee:</span>
                    <span className="font-medium">${setupFee.toLocaleString()}</span>
                  </div>
                )}

                {effectiveDate && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Effective Date:</span>
                    <span className="font-medium">{format(effectiveDate, 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Due Today:</span>
                  <span className="font-bold text-xl">
                    ${setupFee > 0 ? setupFee.toLocaleString() : '0.00'}
                  </span>
                </div>
                {setupFee === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Your card will be saved. First charge on your effective date.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
