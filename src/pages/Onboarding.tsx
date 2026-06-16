import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/contexts/PortalContext";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRecoveryBanner } from "@/components/ui/form-recovery-banner";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { Loader2, ArrowRight, ArrowLeft, Building2, User, MapPin, Briefcase } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { z } from "zod";
import { INITIAL_INTAKE_DATA, type IntakeFormData } from "@/types/franchisee";


type OnboardingSelectedPlan = {
  category: string;
  plans: {
    category: string | null;
  } | null;
};

const DEFAULT_PLAN_CATEGORY = "Other";

// Form validation schema
const createIntakeSchema = (requiresPaidMediaBudget: boolean) => z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  legalBusinessName: z.string().min(2, "Legal business name is required"),
  legalEntity: z.string().min(2, "Legal entity type is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  positionTitle: z.string().min(2, "Position title is required"),
  businessPhone: z.string().min(10, "Business phone must be at least 10 digits"),
  cellPhone: z.string().min(10, "Cell phone must be at least 10 digits"),
  franchiseLocationName: z.string().min(2, "Franchise location name is required"),
  streetAddress: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "ZIP code must be at least 5 characters"),
  isNewLocation: z.boolean(),
  grandOpeningDate: z.string().optional(),
  additionalNotes: z.string().optional(),
  paidMediaBudget: z.string().optional(),
}).superRefine((data, ctx) => {
  // If it's a new location, grand opening date is required
  if (data.isNewLocation && !data.grandOpeningDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Grand opening date is required for new locations",
      path: ["grandOpeningDate"],
    });
  }

  if (requiresPaidMediaBudget && !data.paidMediaBudget?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Annual Paid Media Buy Budget is required for Paid Media plans",
      path: ["paidMediaBudget"],
    });
  }
});

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { portal } = usePortal();
  
  // Support both flows: new franchisee (plan_id) or existing (franchisee_id from payment-first)
  const planId = searchParams.get("plan_id");
  const franchiseeId = searchParams.get("franchisee_id");
  const brandId = searchParams.get("brand_id");
  const customerType = searchParams.get("customer_type") === "existing" ? "existing" : "new";
  
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const hasHydratedRef = useRef(false);

  // Fetch existing franchisee if we have a franchisee_id (payment-first flow)
  const { data: existingFranchisee, isLoading: franchiseeLoading } = useQuery({
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

  // Determine the effective plan ID and brand ID
  const effectivePlanId = planId || existingFranchisee?.plan_id;
  const effectiveBrandId = brandId || existingFranchisee?.brand_id;

  // Form persistence
  const {
    data: formData,
    setData: setFormData,
    updateField,
    clearPersistedData,
    hasPersistedData,
    restoreData,
    lastSavedAt,
    isDirty,
  } = useFormPersistence<IntakeFormData>({
    key: `onboarding_${effectivePlanId || franchiseeId}`,
    initialData: INITIAL_INTAKE_DATA,
    debounceMs: 1000,
  });

  // Fetch plan details
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["plan", effectivePlanId],
    queryFn: async () => {
      if (!effectivePlanId) return null;
      const { data, error } = await supabase
        .from("plans")
        .select("*, brands(*)")
        .eq("id", effectivePlanId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectivePlanId,
  });

  const { data: selectedPlanRows = [], isLoading: selectedPlanCategoriesLoading } = useQuery({
    queryKey: ["franchisee-selected-plan-categories", franchiseeId],
    queryFn: async () => {
      if (!franchiseeId) return [];

      const { data, error } = await supabase
        .from("franchisee_plans")
        .select("category, plans(category)")
        .eq("franchisee_id", franchiseeId);

      if (error) throw error;
      return (data || []) as OnboardingSelectedPlan[];
    },
    enabled: !!franchiseeId,
  });

  const selectedCategorySet = useMemo(() => {
    const categories = selectedPlanRows.map(
      (selection) => selection.category || selection.plans?.category || DEFAULT_PLAN_CATEGORY,
    );

    if (categories.length === 0 && plan?.category) {
      categories.push(plan.category);
    }

    return new Set(categories);
  }, [plan?.category, selectedPlanRows]);

  const paidMediaParam = searchParams.get("paid_media") === "true";
  const requiresPaidMediaBudget =
    existingFranchisee?.include_paid_media === true ||
    paidMediaParam ||
    plan?.requires_paid_media === true ||
    selectedCategorySet.has("Paid Media");
  const effectiveIncludePaidMedia = requiresPaidMediaBudget;

  // Fetch brand details
  const { data: brand } = useQuery({
    queryKey: ["brand", effectiveBrandId],
    queryFn: async () => {
      if (!effectiveBrandId) return null;
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("id", effectiveBrandId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveBrandId,
  });

  // Redirect guards
  useEffect(() => {
    // Wait for data to load
    if (planLoading || franchiseeLoading) return;

    // No plan or franchisee context - redirect to start
    if (!planId && !franchiseeId) {
      toast.error("Please select a plan first");
      navigate("/select-brand");
      return;
    }

    // If franchisee_id was provided but franchisee doesn't exist - invalid link
    if (franchiseeId && !existingFranchisee) {
      toast.error("Invalid or expired registration link");
      navigate("/select-brand");
      return;
    }

    // If we have a franchisee, check their status
    if (existingFranchisee) {
      // Already signed - cannot access this page
      if (existingFranchisee.signature_data || existingFranchisee.onboarding_step === "complete") {
        toast.info("Your signup is already complete");
        navigate(`/confirmation?franchisee_id=${franchiseeId}`);
        return;
      }

      // Check if payment is required and not yet completed
      // For payment-first portals: check payment_status
      const hasCompletedPayment = existingFranchisee.payment_status &&
        ['paid', 'authorized', 'trialing'].includes(existingFranchisee.payment_status);
      
      // If they have placeholder data and haven't paid, redirect to payment
      if (!hasCompletedPayment && existingFranchisee.status === 'pending') {
        if (existingFranchisee.name === 'Pending Registration' || existingFranchisee.email === 'pending@temp.local') {
          toast.error("Please complete payment first");
          navigate(`/payment-processing?franchisee_id=${franchiseeId}`);
          return;
        }
      }
    }
  }, [planId, franchiseeId, planLoading, franchiseeLoading, existingFranchisee, navigate]);

  // Reset readiness when the underlying identity changes (prevents validating during brief query transitions)
  useEffect(() => {
    hasHydratedRef.current = false;
    setIsDataReady(false);
  }, [franchiseeId, effectivePlanId]);

  // Populate form with existing franchisee data on first load
  useEffect(() => {
    // Wait for loading to complete
    if (franchiseeLoading || planLoading) return;

    // In payment-first flow, we require the franchisee record before considering the form ready
    if (franchiseeId && !existingFranchisee) return;

    // If a plan should be loaded, wait until it exists (prevents a one-render "flash" where plan query just enabled)
    if (effectivePlanId && !plan) return;

    if (hasHydratedRef.current) return;
    
    // For the payment-first flow with existing franchisee
    if (existingFranchisee && formData.businessName === '') {
      const locationDetails = existingFranchisee.location_details as Partial<Record<keyof IntakeFormData, string | boolean>> || {};
      const existingData: Partial<IntakeFormData> = {};
      
      if (existingFranchisee.name && existingFranchisee.name !== 'Pending Registration') {
        existingData.businessName = existingFranchisee.name;
      }
      if (existingFranchisee.legal_business_name) existingData.legalBusinessName = existingFranchisee.legal_business_name;
      if (existingFranchisee.legal_entity) existingData.legalEntity = existingFranchisee.legal_entity;
      if (locationDetails.firstName) existingData.firstName = locationDetails.firstName;
      if (locationDetails.lastName) existingData.lastName = locationDetails.lastName;
      if (existingFranchisee.email && existingFranchisee.email !== 'pending@temp.local') {
        existingData.email = existingFranchisee.email;
      }
      if (existingFranchisee.position_title) existingData.positionTitle = existingFranchisee.position_title;
      if (existingFranchisee.business_phone) existingData.businessPhone = existingFranchisee.business_phone;
      if (existingFranchisee.cell_phone) existingData.cellPhone = existingFranchisee.cell_phone;
      if (existingFranchisee.franchise_location_name) existingData.franchiseLocationName = existingFranchisee.franchise_location_name;
      if (locationDetails.streetAddress) existingData.streetAddress = locationDetails.streetAddress;
      if (locationDetails.city) existingData.city = locationDetails.city;
      if (locationDetails.state) existingData.state = locationDetails.state;
      if (locationDetails.zipCode) existingData.zipCode = locationDetails.zipCode;
      if (existingFranchisee.is_new_location !== null) existingData.isNewLocation = existingFranchisee.is_new_location;
      if (existingFranchisee.grand_opening_date) existingData.grandOpeningDate = existingFranchisee.grand_opening_date;
      if (locationDetails.additionalNotes) existingData.additionalNotes = locationDetails.additionalNotes;
      if (existingFranchisee.paid_media_budget) existingData.paidMediaBudget = existingFranchisee.paid_media_budget;
      
      if (Object.keys(existingData).length > 0) {
        // NOTE: setFormData is async; do not mark the form as ready until the next render.
        // This prevents first-click validation against the pre-hydrated empty state.
        setFormData({ ...INITIAL_INTAKE_DATA, ...existingData });
        hasHydratedRef.current = true;
        return;
      }
    }

    hasHydratedRef.current = true;
  }, [existingFranchisee, formData.businessName, setFormData, franchiseeLoading, planLoading, franchiseeId, effectivePlanId, plan]);

  // Mark the form as "ready" only after hydration has actually landed in state.
  // For contract-only flow (no franchiseeId), the form is immediately ready.
  useEffect(() => {
    if (planLoading || franchiseeLoading) return;

    // In payment-first flow, wait until hydration effect has run.
    if (franchiseeId) {
      if (!existingFranchisee) return;
      if (!hasHydratedRef.current) return;

      const hasRequiredValues =
        formData.businessName.trim().length > 0 &&
        formData.legalBusinessName.trim().length > 0 &&
        formData.legalEntity.trim().length > 0 &&
        formData.firstName.trim().length > 0 &&
        formData.lastName.trim().length > 0 &&
        formData.email.trim().length > 0 &&
        formData.positionTitle.trim().length > 0 &&
        formData.businessPhone.trim().length > 0 &&
        formData.cellPhone.trim().length > 0 &&
        formData.franchiseLocationName.trim().length > 0 &&
        formData.streetAddress.trim().length > 0 &&
        formData.city.trim().length > 0 &&
        formData.state.trim().length > 0 &&
        formData.zipCode.trim().length > 0 &&
        (!requiresPaidMediaBudget || formData.paidMediaBudget.trim().length > 0);

      setIsDataReady(hasRequiredValues);
      return;
    }

    // Contract-only flow
    setIsDataReady(true);
  }, [
    franchiseeId,
    existingFranchisee,
    planLoading,
    franchiseeLoading,
    formData.businessName,
    formData.legalBusinessName,
    formData.legalEntity,
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.positionTitle,
    formData.businessPhone,
    formData.cellPhone,
    formData.franchiseLocationName,
    formData.streetAddress,
    formData.city,
    formData.state,
    formData.zipCode,
    formData.paidMediaBudget,
    requiresPaidMediaBudget,
  ]);

  const validateForm = (): boolean => {
    try {
      createIntakeSchema(requiresPaidMediaBudget).parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof IntakeFormData, string>> = {};
        error.errors.forEach((err) => {
          const field = err.path[0] as keyof IntakeFormData;
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

    setIsSubmitting(true);

    try {
      const franchiseeData = {
        name: formData.businessName,
        email: formData.email,
        phone: formData.businessPhone,
        business_phone: formData.businessPhone,
        cell_phone: formData.cellPhone,
        brand_id: effectiveBrandId || plan?.brand_id,
        plan_id: effectivePlanId,
        status: "pending",
        address: `${formData.streetAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}`,
        include_paid_media: effectiveIncludePaidMedia,
        paid_media_budget: requiresPaidMediaBudget ? formData.paidMediaBudget.trim() : null,
        customer_type: existingFranchisee?.customer_type ?? customerType,
        legal_business_name: formData.legalBusinessName,
        legal_entity: formData.legalEntity,
        position_title: formData.positionTitle,
        franchise_location_name: formData.franchiseLocationName,
        is_new_location: formData.isNewLocation,
        grand_opening_date: formData.grandOpeningDate || null,
        onboarding_step: 'representatives',
        location_details: {
          streetAddress: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          firstName: formData.firstName,
          lastName: formData.lastName,
          additionalNotes: formData.additionalNotes,
        },
      };

      let resultFranchiseeId: string;
      let updatedRow: typeof existingFranchisee | null = null;

      if (franchiseeId) {
        // Update existing franchisee (payment-first flow)
        const { data, error } = await supabase
          .from("franchisees")
          .update(franchiseeData)
          .eq("id", franchiseeId)
          .select(
            "id,onboarding_step,name,email,phone,business_phone,cell_phone,brand_id,plan_id,include_paid_media,paid_media_budget,legal_business_name,legal_entity,position_title,franchise_location_name,is_new_location,grand_opening_date,location_details"
          )
          .single();

        if (error) throw error;
        resultFranchiseeId = franchiseeId;
        updatedRow = data;
      } else {
        // Create new franchisee record (contract-only flow)
        const { data: franchisee, error } = await supabase
          .from("franchisees")
          .insert(franchiseeData)
          .select()
          .single();

        if (error) throw error;
        resultFranchiseeId = franchisee.id;
        updatedRow = franchisee;
      }

      // Ensure the next page sees the updated step immediately (prevents rare redirect loops
      // if Representatives renders against stale cached data for a moment).
      queryClient.setQueryData(["franchisee", resultFranchiseeId], (old: typeof existingFranchisee | null | undefined) => {
        if (updatedRow) return { ...old, ...updatedRow };
        if (!old) return old;
        return { ...old, ...franchiseeData, id: resultFranchiseeId };
      });

      // Refetch to synchronize with backend before navigating
      await queryClient.refetchQueries({ queryKey: ["franchisee", resultFranchiseeId] });

      // Only clear the draft once we're sure the step is persisted.
      if (updatedRow?.onboarding_step === 'representatives') {
        clearPersistedData();
      }

      toast.success("Information saved successfully!");
      
      // Navigate to representatives page
      navigate(`/representatives?franchisee_id=${resultFranchiseeId}`);
    } catch (error: unknown) {
      console.error("Error submitting onboarding form:", error);
      const message = error instanceof Error ? error.message : "Failed to save information. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (franchiseeId && existingFranchisee?.brand_id) {
      // Payment-first flow - go back to plan selection
      const params = new URLSearchParams({ brand_id: existingFranchisee.brand_id });
      navigate(`/select-plan?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ brand_id: effectiveBrandId || plan?.brand_id || '' });
      params.set('customer_type', customerType);
      navigate(`/select-plan?${params.toString()}`);
    }
  };

  const isLoading = planLoading || franchiseeLoading || selectedPlanCategoriesLoading;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  const displayBrand = brand || plan?.brands;

  return (
    <PortalLayout>
      <div className="content-max px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Hide back button in payment-first flow — plan is locked once payment is made */}
          {!franchiseeId && (
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
            Business Information
          </h1>
          <p className="text-body text-muted-foreground">
            Please provide your business details to continue with{" "}
            <span className="font-semibold text-foreground">{plan?.name}</span>
            {effectiveIncludePaidMedia && " + Paid Media"}
          </p>
        </div>

        {/* Form Recovery Banner */}
        {hasPersistedData && (
          <FormRecoveryBanner
            onRestore={restoreData}
            onDismiss={clearPersistedData}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Business Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Business Information
                  </CardTitle>
                  <CardDescription>
                    Enter your franchise business details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name (DBA) *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => updateField("businessName", e.target.value)}
                      placeholder="e.g., ABC Franchise - Downtown"
                      className={errors.businessName ? "border-destructive" : ""}
                    />
                    {errors.businessName && (
                      <p className="text-sm text-destructive mt-1">{errors.businessName}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="legalBusinessName">Legal Business Name *</Label>
                      <Input
                        id="legalBusinessName"
                        value={formData.legalBusinessName}
                        onChange={(e) => updateField("legalBusinessName", e.target.value)}
                        placeholder="e.g., ABC Franchise LLC"
                        className={errors.legalBusinessName ? "border-destructive" : ""}
                      />
                      {errors.legalBusinessName && (
                        <p className="text-sm text-destructive mt-1">{errors.legalBusinessName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="legalEntity">Legal Entity Type *</Label>
                      <Input
                        id="legalEntity"
                        value={formData.legalEntity}
                        onChange={(e) => updateField("legalEntity", e.target.value)}
                        placeholder="e.g., LLC, Corporation, Partnership"
                        className={errors.legalEntity ? "border-destructive" : ""}
                      />
                      {errors.legalEntity && (
                        <p className="text-sm text-destructive mt-1">{errors.legalEntity}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Signer Information
                  </CardTitle>
                  <CardDescription>
                    Details of the person signing the contract
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateField("firstName", e.target.value)}
                        placeholder="John"
                        className={errors.firstName ? "border-destructive" : ""}
                      />
                      {errors.firstName && (
                        <p className="text-sm text-destructive mt-1">{errors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateField("lastName", e.target.value)}
                        placeholder="Doe"
                        className={errors.lastName ? "border-destructive" : ""}
                      />
                      {errors.lastName && (
                        <p className="text-sm text-destructive mt-1">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="positionTitle">Position/Title *</Label>
                    <Input
                      id="positionTitle"
                      value={formData.positionTitle}
                      onChange={(e) => updateField("positionTitle", e.target.value)}
                      placeholder="e.g., Owner, General Manager, Franchisee"
                      className={errors.positionTitle ? "border-destructive" : ""}
                    />
                    {errors.positionTitle && (
                      <p className="text-sm text-destructive mt-1">{errors.positionTitle}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="john.doe@example.com"
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="businessPhone">Business Phone *</Label>
                      <Input
                        id="businessPhone"
                        type="tel"
                        value={formData.businessPhone}
                        onChange={(e) => updateField("businessPhone", e.target.value)}
                        placeholder="(555) 123-4567"
                        className={errors.businessPhone ? "border-destructive" : ""}
                      />
                      {errors.businessPhone && (
                        <p className="text-sm text-destructive mt-1">{errors.businessPhone}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="cellPhone">Cell Phone *</Label>
                      <Input
                        id="cellPhone"
                        type="tel"
                        value={formData.cellPhone}
                        onChange={(e) => updateField("cellPhone", e.target.value)}
                        placeholder="(555) 987-6543"
                        className={errors.cellPhone ? "border-destructive" : ""}
                      />
                      {errors.cellPhone && (
                        <p className="text-sm text-destructive mt-1">{errors.cellPhone}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Location Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Location Information
                  </CardTitle>
                  <CardDescription>
                    Franchise location details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="franchiseLocationName">Franchise Location Name *</Label>
                    <Input
                      id="franchiseLocationName"
                      value={formData.franchiseLocationName}
                      onChange={(e) => updateField("franchiseLocationName", e.target.value)}
                      placeholder="e.g., Downtown Location, Mall Store #123"
                      className={errors.franchiseLocationName ? "border-destructive" : ""}
                    />
                    {errors.franchiseLocationName && (
                      <p className="text-sm text-destructive mt-1">{errors.franchiseLocationName}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="streetAddress">Street Address *</Label>
                    <Input
                      id="streetAddress"
                      value={formData.streetAddress}
                      onChange={(e) => updateField("streetAddress", e.target.value)}
                      placeholder="123 Main Street, Suite 100"
                      className={errors.streetAddress ? "border-destructive" : ""}
                    />
                    {errors.streetAddress && (
                      <p className="text-sm text-destructive mt-1">{errors.streetAddress}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateField("city", e.target.value)}
                        placeholder="San Diego"
                        className={errors.city ? "border-destructive" : ""}
                      />
                      {errors.city && (
                        <p className="text-sm text-destructive mt-1">{errors.city}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        placeholder="CA"
                        className={errors.state ? "border-destructive" : ""}
                      />
                      {errors.state && (
                        <p className="text-sm text-destructive mt-1">{errors.state}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code *</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => updateField("zipCode", e.target.value)}
                        placeholder="92101"
                        className={errors.zipCode ? "border-destructive" : ""}
                      />
                      {errors.zipCode && (
                        <p className="text-sm text-destructive mt-1">{errors.zipCode}</p>
                      )}
                    </div>
                  </div>

                  {/* New Location Toggle */}
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isNewLocation"
                        checked={formData.isNewLocation}
                        onCheckedChange={(checked) => updateField("isNewLocation", checked as boolean)}
                      />
                      <Label htmlFor="isNewLocation" className="cursor-pointer">
                        This is a new location (grand opening)
                      </Label>
                    </div>

                    {formData.isNewLocation && (
                      <div>
                        <Label htmlFor="grandOpeningDate">Grand Opening Date *</Label>
                        <Input
                          id="grandOpeningDate"
                          type="date"
                          value={formData.grandOpeningDate}
                          onChange={(e) => updateField("grandOpeningDate", e.target.value)}
                          className={errors.grandOpeningDate ? "border-destructive" : ""}
                        />
                        {errors.grandOpeningDate && (
                          <p className="text-sm text-destructive mt-1">{errors.grandOpeningDate}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Additional Information
                  </CardTitle>
                  <CardDescription>
                    Any other details you'd like us to know
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {requiresPaidMediaBudget && (
                    <div>
                      <Label htmlFor="paidMediaBudget">What is your Annual Paid Media Buy Budget? *</Label>
                      <Input
                        id="paidMediaBudget"
                        value={formData.paidMediaBudget}
                        onChange={(e) => updateField("paidMediaBudget", e.target.value)}
                        placeholder="e.g., $120,000"
                        className={errors.paidMediaBudget ? "border-destructive" : ""}
                      />
                      {errors.paidMediaBudget && (
                        <p className="text-sm text-destructive mt-1">{errors.paidMediaBudget}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="additionalNotes">Additional Notes</Label>
                    <Textarea
                      id="additionalNotes"
                      value={formData.additionalNotes}
                      onChange={(e) => updateField("additionalNotes", e.target.value)}
                      placeholder="Any additional information you'd like us to know..."
                      rows={3}
                    />
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
                    {displayBrand && (
                      <div className="flex items-center gap-2 pb-3 border-b border-border">
                        {displayBrand.logo_url && (
                          <img
                            src={displayBrand.logo_url}
                            alt={displayBrand.name}
                            className="h-8 w-auto object-contain"
                          />
                        )}
                        <span className="font-medium">{displayBrand.name}</span>
                      </div>
                    )}
                    
                    <div>
                      <p className="font-semibold text-lg">{plan?.name}</p>
                      <p className="text-2xl font-bold text-primary">
                        ${plan?.monthly_price?.toLocaleString()}/mo
                      </p>
                    </div>

                    {effectiveIncludePaidMedia && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm font-medium text-primary">
                          + Paid Media Services
                        </p>
                      </div>
                    )}

                    {plan?.setup_fee && Number(plan.setup_fee) > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          Setup Fee: ${Number(plan.setup_fee).toLocaleString()}
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
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">2</div>
                        <span className="text-sm font-medium">Business Information</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">3</div>
                        <span className="text-sm text-muted-foreground">Representatives</span>
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
                      Continue to Representatives
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
