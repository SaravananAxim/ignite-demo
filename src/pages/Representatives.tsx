import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/contexts/PortalContext";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { Loader2, ArrowRight, ArrowLeft, Users, Receipt } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { z } from "zod";
import { INITIAL_REPRESENTATIVES_DATA, type RepresentativesFormData } from "@/types/franchisee";

// Form validation schema
const representativesSchema = z.object({
  campaignRepName: z.string().min(2, "Campaign representative name is required"),
  campaignRepEmail: z.string().email("Invalid email address"),
  campaignRepPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  signerIsCampaignRep: z.boolean(),
  billingRepName: z.string().min(2, "Billing representative name is required"),
  billingRepEmail: z.string().email("Invalid email address"),
  billingRepPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  signerIsBillingRep: z.boolean(),
});

export default function Representatives() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { portal } = usePortal();
  
  const franchiseeId = searchParams.get("franchisee_id");
  
  const [errors, setErrors] = useState<Partial<Record<keyof RepresentativesFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const hasHydratedRef = useRef(false);

  // Fetch existing franchisee
  const { data: franchisee, isLoading } = useQuery({
    queryKey: ["franchisee", franchiseeId],
    queryFn: async () => {
      if (!franchiseeId) return null;
      const { data, error } = await supabase
        .from("franchisees")
        .select("*, plans(*), brands(*)")
        .eq("id", franchiseeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!franchiseeId,
  });

  // Form persistence
  const {
    data: formData,
    setData: setFormData,
    updateField,
    clearPersistedData,
    lastSavedAt,
    isDirty,
  } = useFormPersistence<RepresentativesFormData>({
    key: `representatives_${franchiseeId}`,
    initialData: INITIAL_REPRESENTATIVES_DATA,
    debounceMs: 1000,
  });

  // Reset readiness when franchisee changes (prevents validating during brief query transitions)
  useEffect(() => {
    hasHydratedRef.current = false;
    setIsDataReady(false);
  }, [franchiseeId]);

  // Populate form with existing franchisee data on first load
  useEffect(() => {
    // Wait for loading to complete
    if (isLoading) return;

    // Require the franchisee record before considering the form ready
    if (!franchiseeId || !franchisee) return;

    if (hasHydratedRef.current) return;
    
    if (franchisee && formData.campaignRepName === '' && formData.billingRepName === '') {
      const existingData: Partial<RepresentativesFormData> = {};
      
      if (franchisee.campaign_rep_name) existingData.campaignRepName = franchisee.campaign_rep_name;
      if (franchisee.campaign_rep_email) existingData.campaignRepEmail = franchisee.campaign_rep_email;
      if (franchisee.campaign_rep_phone) existingData.campaignRepPhone = franchisee.campaign_rep_phone;
      if (franchisee.billing_rep_name) existingData.billingRepName = franchisee.billing_rep_name;
      if (franchisee.billing_rep_email) existingData.billingRepEmail = franchisee.billing_rep_email;
      if (franchisee.billing_rep_phone) existingData.billingRepPhone = franchisee.billing_rep_phone;
      
      if (Object.keys(existingData).length > 0) {
        // NOTE: setFormData is async; do not mark the form as ready until the next render
        // (prevents first-click validation against the pre-hydrated empty state)
        setFormData({ ...INITIAL_REPRESENTATIVES_DATA, ...existingData });
        hasHydratedRef.current = true;
        return;
      }
    }
    
    hasHydratedRef.current = true;
  }, [franchisee, formData.campaignRepName, formData.billingRepName, setFormData, isLoading, franchiseeId]);

  // Mark the form as "ready" only after hydration has actually landed in state.
  // This prevents a brief flash where the UI looks filled but validateForm sees stale empty values.
  useEffect(() => {
    if (isLoading) return;
    if (!franchiseeId || !franchisee) return;
    if (!hasHydratedRef.current) return;

    const hasRequiredValues =
      formData.campaignRepName.trim().length > 0 &&
      formData.campaignRepEmail.trim().length > 0 &&
      formData.campaignRepPhone.trim().length > 0 &&
      formData.billingRepName.trim().length > 0 &&
      formData.billingRepEmail.trim().length > 0 &&
      formData.billingRepPhone.trim().length > 0;

    if (hasRequiredValues) {
      setIsDataReady(true);
    }
  }, [
    isLoading,
    franchiseeId,
    franchisee,
    formData.campaignRepName,
    formData.campaignRepEmail,
    formData.campaignRepPhone,
    formData.billingRepName,
    formData.billingRepEmail,
    formData.billingRepPhone,
  ]);

  // Redirect guards
  useEffect(() => {
    // Wait for data to load
    if (isLoading) return;

    // No franchisee ID - redirect to start
    if (!franchiseeId) {
      toast.error("Missing franchisee information");
      navigate("/select-brand");
      return;
    }

    // If franchisee_id was provided but franchisee doesn't exist - invalid link
    if (franchiseeId && !franchisee) {
      toast.error("Invalid or expired registration link");
      navigate("/select-brand");
      return;
    }

    // If we have a franchisee, check their status
    if (franchisee) {
      // Already signed - cannot access this page
      if (franchisee.signature_data || franchisee.onboarding_step === "complete") {
        toast.info("Your signup is already complete");
        navigate(`/confirmation?franchisee_id=${franchiseeId}`);
        return;
      }

      // Must have completed payment first (for payment-required portals)
      const hasCompletedPayment = franchisee.payment_status && 
        ['paid', 'authorized', 'trialing', 'pending_checkout'].includes(franchisee.payment_status);
      
      if (!hasCompletedPayment && franchisee.status === 'pending') {
        if (franchisee.name === 'Pending Registration' || franchisee.email === 'pending@temp.local') {
          toast.error("Please complete payment first");
          navigate(`/payment-processing?franchisee_id=${franchiseeId}`);
          return;
        }
      }

      // Must have completed intake form first
      if (!franchisee.onboarding_step || franchisee.onboarding_step === 'payment' || franchisee.onboarding_step === 'intake') {
        toast.error("Please complete business information first");
        navigate(`/onboarding?franchisee_id=${franchiseeId}`);
        return;
      }
    }
  }, [franchiseeId, isLoading, franchisee, navigate]);

  // Get signer info from franchisee for autofill
  const signerName = franchisee 
    ? `${(franchisee.location_details as any)?.firstName || ''} ${(franchisee.location_details as any)?.lastName || ''}`.trim()
    : '';
  const signerEmail = franchisee?.email || '';
  const signerPhone = franchisee?.cell_phone || franchisee?.phone || '';

  // Handle "Signer is Campaign Rep" toggle
  const handleSignerIsCampaignRep = (checked: boolean) => {
    updateField("signerIsCampaignRep", checked);
    if (checked) {
      updateField("campaignRepName", signerName);
      updateField("campaignRepEmail", signerEmail);
      updateField("campaignRepPhone", signerPhone);
    }
  };

  // Handle "Signer is Billing Rep" toggle
  const handleSignerIsBillingRep = (checked: boolean) => {
    updateField("signerIsBillingRep", checked);
    if (checked) {
      updateField("billingRepName", signerName);
      updateField("billingRepEmail", signerEmail);
      updateField("billingRepPhone", signerPhone);
    }
  };

  const validateForm = (): boolean => {
    try {
      representativesSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof RepresentativesFormData, string>> = {};
        error.errors.forEach((err) => {
          const field = err.path[0] as keyof RepresentativesFormData;
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't validate until data is ready
    if (!isDataReady) {
      toast.error("Please wait, loading your information...");
      return;
    }
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    if (!franchiseeId) {
      toast.error("Missing franchisee ID");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: updatedFranchisee, error } = await supabase
        .from("franchisees")
        .update({
          campaign_rep_name: formData.campaignRepName,
          campaign_rep_email: formData.campaignRepEmail,
          campaign_rep_phone: formData.campaignRepPhone,
          billing_rep_name: formData.billingRepName,
          billing_rep_email: formData.billingRepEmail,
          billing_rep_phone: formData.billingRepPhone,
          onboarding_step: 'contract',
        })
        .eq("id", franchiseeId)
        .select("id,onboarding_step,campaign_rep_name,campaign_rep_email,campaign_rep_phone,billing_rep_name,billing_rep_email,billing_rep_phone,plan_id,brand_id")
        .single();

      if (error) throw error;

      // Ensure the next page sees the updated step immediately (prevents a redirect loop
      // if ContractReview renders against stale cached data for a moment).
      queryClient.setQueryData(["franchisee", franchiseeId], (old: any) => {
        // Prefer the definitive backend row when available
        if (updatedFranchisee) return { ...old, ...updatedFranchisee };
        if (!old) return old;
        return {
          ...old,
          campaign_rep_name: formData.campaignRepName,
          campaign_rep_email: formData.campaignRepEmail,
          campaign_rep_phone: formData.campaignRepPhone,
          billing_rep_name: formData.billingRepName,
          billing_rep_email: formData.billingRepEmail,
          billing_rep_phone: formData.billingRepPhone,
          onboarding_step: 'contract',
        };
      });

      // Refetch to synchronize with backend before navigating
      await queryClient.refetchQueries({ queryKey: ["franchisee", franchiseeId] });

      // Only clear persisted form data once we have the updated row (prevents wiping the form
      // if the user gets bounced back due to any stale-step edge case).
      if (updatedFranchisee?.onboarding_step === 'contract') {
        clearPersistedData();
      }

      toast.success("Representative information saved!");
      
      // Navigate to contract review
      navigate(`/contract-review?franchisee_id=${franchiseeId}`);
    } catch (error: any) {
      console.error("Error saving representatives:", error);
      toast.error(error.message || "Failed to save information. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate(`/onboarding?franchisee_id=${franchiseeId}`);
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="content-max px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Business Information
          </Button>
          
          <h1 className="text-page-title text-foreground mb-2">
            Representative Information
          </h1>
          <p className="text-body text-muted-foreground">
            Please provide contact information for your campaign and billing representatives.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Representative */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Campaign Representative
                  </CardTitle>
                  <CardDescription>
                    Primary contact for marketing and campaign communications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Autofill checkbox */}
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="signerIsCampaignRep"
                      checked={formData.signerIsCampaignRep}
                      onCheckedChange={handleSignerIsCampaignRep}
                    />
                    <Label htmlFor="signerIsCampaignRep" className="text-sm cursor-pointer">
                      I am the campaign representative (use my information)
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor="campaignRepName">Full Name *</Label>
                    <Input
                      id="campaignRepName"
                      value={formData.campaignRepName}
                      onChange={(e) => updateField("campaignRepName", e.target.value)}
                      placeholder="Jane Smith"
                      disabled={formData.signerIsCampaignRep}
                      className={errors.campaignRepName ? "border-destructive" : ""}
                    />
                    {errors.campaignRepName && (
                      <p className="text-sm text-destructive mt-1">{errors.campaignRepName}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="campaignRepEmail">Email Address *</Label>
                      <Input
                        id="campaignRepEmail"
                        type="email"
                        value={formData.campaignRepEmail}
                        onChange={(e) => updateField("campaignRepEmail", e.target.value)}
                        placeholder="jane@example.com"
                        disabled={formData.signerIsCampaignRep}
                        className={errors.campaignRepEmail ? "border-destructive" : ""}
                      />
                      {errors.campaignRepEmail && (
                        <p className="text-sm text-destructive mt-1">{errors.campaignRepEmail}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="campaignRepPhone">Phone Number *</Label>
                      <Input
                        id="campaignRepPhone"
                        type="tel"
                        value={formData.campaignRepPhone}
                        onChange={(e) => updateField("campaignRepPhone", e.target.value)}
                        placeholder="(555) 123-4567"
                        disabled={formData.signerIsCampaignRep}
                        className={errors.campaignRepPhone ? "border-destructive" : ""}
                      />
                      {errors.campaignRepPhone && (
                        <p className="text-sm text-destructive mt-1">{errors.campaignRepPhone}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Representative */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Billing Representative
                  </CardTitle>
                  <CardDescription>
                    Primary contact for invoices and payment-related communications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Autofill checkbox */}
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="signerIsBillingRep"
                      checked={formData.signerIsBillingRep}
                      onCheckedChange={handleSignerIsBillingRep}
                    />
                    <Label htmlFor="signerIsBillingRep" className="text-sm cursor-pointer">
                      I am the billing representative (use my information)
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor="billingRepName">Full Name *</Label>
                    <Input
                      id="billingRepName"
                      value={formData.billingRepName}
                      onChange={(e) => updateField("billingRepName", e.target.value)}
                      placeholder="John Doe"
                      disabled={formData.signerIsBillingRep}
                      className={errors.billingRepName ? "border-destructive" : ""}
                    />
                    {errors.billingRepName && (
                      <p className="text-sm text-destructive mt-1">{errors.billingRepName}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="billingRepEmail">Email Address *</Label>
                      <Input
                        id="billingRepEmail"
                        type="email"
                        value={formData.billingRepEmail}
                        onChange={(e) => updateField("billingRepEmail", e.target.value)}
                        placeholder="billing@example.com"
                        disabled={formData.signerIsBillingRep}
                        className={errors.billingRepEmail ? "border-destructive" : ""}
                      />
                      {errors.billingRepEmail && (
                        <p className="text-sm text-destructive mt-1">{errors.billingRepEmail}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="billingRepPhone">Phone Number *</Label>
                      <Input
                        id="billingRepPhone"
                        type="tel"
                        value={formData.billingRepPhone}
                        onChange={(e) => updateField("billingRepPhone", e.target.value)}
                        placeholder="(555) 987-6543"
                        disabled={formData.signerIsBillingRep}
                        className={errors.billingRepPhone ? "border-destructive" : ""}
                      />
                      {errors.billingRepPhone && (
                        <p className="text-sm text-destructive mt-1">{errors.billingRepPhone}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                {/* Auto-save indicator */}
                <AutoSaveIndicator
                  lastSavedAt={lastSavedAt}
                  isSaving={isDirty}
                />

                {/* Plan Summary */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {franchisee?.brands && (
                      <div className="flex items-center gap-2 pb-3 border-b border-border">
                        {(franchisee.brands as any).logo_url && (
                          <img
                            src={(franchisee.brands as any).logo_url}
                            alt={(franchisee.brands as any).name}
                            className="h-8 w-auto object-contain"
                          />
                        )}
                        <span className="font-medium">{(franchisee.brands as any).name}</span>
                      </div>
                    )}
                    
                    <div>
                      <p className="font-semibold text-lg">{(franchisee?.plans as any)?.name}</p>
                      <p className="text-2xl font-bold text-primary">
                        ${(franchisee?.plans as any)?.monthly_price?.toLocaleString()}/mo
                      </p>
                    </div>

                    {franchisee?.include_paid_media && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm font-medium text-primary">
                          + Paid Media Services
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Progress indicator */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">✓</div>
                        <span className="text-sm text-muted-foreground">Payment Complete</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">✓</div>
                        <span className="text-sm text-muted-foreground">Business Information</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">3</div>
                        <span className="text-sm font-medium">Representatives</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">4</div>
                        <span className="text-sm text-muted-foreground">Contract Review</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting || !isDataReady}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to Contract Review
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Your information is saved automatically as you type
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
