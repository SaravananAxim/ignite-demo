import { useState, useEffect, forwardRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ContractViewer } from "@/components/contract/ContractViewer";
import { SignaturePad } from "@/components/contract/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, FileText, PenTool, AlertCircle } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { replacePlaceholders, sanitizeContractHtml, insertSignatureImages, generateContractPDF } from "@/lib/pdfGenerator";
import { activityLogger } from "@/lib/activityLogger";
import { format } from "date-fns";

const ContractReview = forwardRef<HTMLDivElement, Record<string, never>>(function ContractReview(_props, ref) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  const franchiseeId = searchParams.get("franchisee_id");
  
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [acknowledgedReview, setAcknowledgedReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch franchisee details
  const { data: franchisee, isLoading: franchiseeLoading } = useQuery({
    queryKey: ["franchisee", franchiseeId],
    queryFn: async () => {
      if (!franchiseeId) return null;
      const { data, error } = await supabase
        .from("franchisees")
        .select("*, brands(*), plans(*)")
        .eq("id", franchiseeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!franchiseeId,
  });

  // Fetch the contract template assigned to the franchisee's plan
  const planTemplateId = (franchisee?.plans as any)?.contract_template_id ?? null;
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["contract-template", planTemplateId],
    queryFn: async () => {
      if (!planTemplateId) return null;
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("id", planTemplateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !franchiseeLoading && !!planTemplateId,
  });

  // Redirect guards
  useEffect(() => {
    // Wait for data to load
    if (franchiseeLoading) return;

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
        toast.info("You have already signed this contract");
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

      // Must have completed representatives step first
      if (!franchisee.onboarding_step || 
          franchisee.onboarding_step === 'payment' || 
          franchisee.onboarding_step === 'intake' || 
          franchisee.onboarding_step === 'representatives') {
        if (franchisee.onboarding_step === 'representatives') {
          toast.error("Please complete representative information first");
          navigate(`/representatives?franchisee_id=${franchiseeId}`);
        } else {
          toast.error("Please complete business information first");
          navigate(`/onboarding?franchisee_id=${franchiseeId}`);
        }
        return;
      }
    }
  }, [franchiseeId, franchisee, franchiseeLoading, navigate]);

  // Generate contract with placeholders replaced
  const processedContract = (() => {
    if (!template || !franchisee) return "";
    
    const locationDetails = franchisee.location_details as Record<string, string> || {};
    const plan = franchisee.plans as any;
    const brand = franchisee.brands as any;
    const includePaidMedia = franchisee.include_paid_media === true;
    const isNewLocation = franchisee.is_new_location === true;

    // Calculate pricing
    const monthlyPrice = plan?.monthly_price || 0;
    const paidMediaFee = plan?.monthly_price_with_media || 0;
    const setupFee = plan?.setup_fee || 0;
    const totalMonthly = includePaidMedia ? monthlyPrice + paidMediaFee : monthlyPrice;

    // Build full address
    const fullAddress = [
      locationDetails.streetAddress,
      locationDetails.city,
      locationDetails.state,
      locationDetails.zipCode
    ].filter(Boolean).join(", ");

    // All placeholder values matching actual collected data
    const placeholderValues: Record<string, string> = {
      // Business Information
      legalBusinessName: franchisee.legal_business_name || "",
      legalEntity: franchisee.legal_entity || "",
      franchiseLocationName: franchisee.franchise_location_name || "",
      
      // Contact Person
      firstName: locationDetails.firstName || "",
      lastName: locationDetails.lastName || "",
      fullName: [locationDetails.firstName, locationDetails.lastName].filter(Boolean).join(" ") || franchisee.name || "",
      email: franchisee.email || "",
      positionTitle: franchisee.position_title || "",
      businessPhone: franchisee.business_phone || "",
      cellPhone: franchisee.cell_phone || "",
      
      // Address
      streetAddress: locationDetails.streetAddress || franchisee.address || "",
      city: locationDetails.city || "",
      state: locationDetails.state || "",
      zipCode: locationDetails.zipCode || "",
      fullAddress: fullAddress || franchisee.address || "",
      
      // Brand & Plan
      brandName: brand?.name || "",
      portalName: "Ignite Visibility",
      planName: plan?.name || "",
      monthlyPrice: `$${monthlyPrice.toLocaleString()}`,
      setupFee: setupFee ? `$${setupFee.toLocaleString()}` : "$0",
      paidMediaFee: paidMediaFee ? `$${paidMediaFee.toLocaleString()}` : "$0",
      paid_media_budget: franchisee.paid_media_budget || "",
      totalMonthlyPrice: `$${totalMonthly.toLocaleString()}`,
      
      // Dates (use selected effective date from payment step; format for contract)
      // Append 'T00:00:00' to date-only strings so JS parses them as local time, not UTC
      effectiveDate: franchisee.service_start_date
        ? format(new Date(franchisee.service_start_date + "T00:00:00"), "MMMM d, yyyy")
        : format(new Date(), "MMMM d, yyyy"),
      signatureDate: new Date().toLocaleDateString(),
      currentDate: new Date().toLocaleDateString(),
      grandOpeningDate: franchisee.grand_opening_date
        ? format(new Date(franchisee.grand_opening_date + "T00:00:00"), "MMMM d, yyyy")
        : "",
      
      // Representatives
      campaignRepName: franchisee.campaign_rep_name || "",
      campaignRepEmail: franchisee.campaign_rep_email || "",
      campaignRepPhone: franchisee.campaign_rep_phone || "",
      billingRepName: franchisee.billing_rep_name || "",
      billingRepEmail: franchisee.billing_rep_email || "",
      billingRepPhone: franchisee.billing_rep_phone || "",
      
      // Signature placeholders are intentionally omitted here — they survive
      // sanitizeContractHtml and are replaced by insertSignatureImages at display/PDF time.

      // Legacy placeholders for backward compatibility
      franchiseeName: franchisee.name || "",
      franchiseeEmail: franchisee.email || "",
      franchiseeAddress: fullAddress || franchisee.address || "",
    };

    let html = template.html_content;

    // Normalize legacy entity-encoded markers (produced by Quill's insertText) to {{}} format.
    // Quill escapes < and > when inserting plain text, so <!-- section_PaidMedia --> becomes
    // &lt;!-- section_PaidMedia --&gt; in the stored HTML. Normalize to {{}} so the regex below
    // can match them reliably regardless of how the template was authored.
    html = html
      .replace(/&lt;!--\s*section_PaidMedia\s*--&gt;/gi, "{{#section:PaidMedia}}")
      .replace(/&lt;!--\s*\/section_PaidMedia\s*--&gt;/gi, "{{/section:PaidMedia}}")
      .replace(/&lt;!--\s*section_NewLocation\s*--&gt;/gi, "{{#section:NewLocation}}")
      .replace(/&lt;!--\s*\/section_NewLocation\s*--&gt;/gi, "{{/section:NewLocation}}");

    // Handle conditional Paid Media: only show section if paid media is enabled and selected
    if (!includePaidMedia) {
      // Remove entire Paid Media section (markers + content) so nothing from it appears
      html = html.replace(/\{\{#section:PaidMedia\}\}[\s\S]*?\{\{\/section:PaidMedia\}\}/gi, "");
      // Also handle raw HTML comment format (if template was authored outside the editor)
      html = html.replace(/<!--\s*section_PaidMedia\s*-->[\s\S]*?<!--\s*\/section_PaidMedia\s*-->/gi, "");
    } else {
      // Show section; remove only the markers so the content is visible
      html = html.replace(/\{\{[#/]?section:PaidMedia\}\}/gi, "");
      html = html.replace(/<!--\s*\/?section_PaidMedia\s*-->/gi, "");
    }

    // Handle conditional New Location sections
    if (!isNewLocation) {
      html = html.replace(/\{\{#section:NewLocation\}\}[\s\S]*?\{\{\/section:NewLocation\}\}/gi, "");
      html = html.replace(/<!--\s*section_NewLocation\s*-->[\s\S]*?<!--\s*\/section_NewLocation\s*-->/gi, "");
    } else {
      html = html.replace(/\{\{[#/]?section:NewLocation\}\}/gi, "");
      html = html.replace(/<!--\s*\/?section_NewLocation\s*-->/gi, "");
    }

    let result = replacePlaceholders(html, placeholderValues);
    result = sanitizeContractHtml(result);
    return result;
  })();

  // Create generated contract mutation
  const createContractMutation = useMutation({
    mutationFn: async () => {
      if (!franchiseeId || !template || !signatureData) {
        throw new Error("Missing required data");
      }

      // Create generated contract record
      const { data: contract, error: contractError } = await supabase
        .from("generated_contracts")
        .insert({
          franchisee_id: franchiseeId,
          template_id: template.id,
          final_html: processedContract,
          status: "signed_by_franchisee",
          franchisee_signature: signatureData,
          franchisee_signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Update franchisee with signature data and mark onboarding as complete
      const { error: updateError } = await supabase
        .from("franchisees")
        .update({
          signature_data: signatureData,
          signature_date: new Date().toISOString(),
          status: "awaiting_countersign",
          onboarding_step: "complete",
        })
        .eq("id", franchiseeId);

      if (updateError) throw updateError;

      return contract;
    },
    onSuccess: async (contract) => {
      queryClient.invalidateQueries({ queryKey: ["franchisee", franchiseeId] });
      
      // Log contract signing
      if (contract?.id) {
        await activityLogger.contractSigned(contract.id, {
          franchisee_name: franchisee?.name,
          franchisee_id: franchiseeId
        });

        // Generate and upload franchisee-signed PDF so pdf_url is populated in the webhook
        try {
          const pdfHtml = insertSignatureImages(
            processedContract,
            signatureData,
            null,
            format(new Date(), "MMMM d, yyyy"),
            null
          );
          const pdfBlob = await generateContractPDF(pdfHtml, `${contract.id}.pdf`);
          const { error: uploadError } = await supabase.storage
            .from("contracts")
            .upload(`${contract.id}.pdf`, pdfBlob, { contentType: "application/pdf", upsert: true });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(`${contract.id}.pdf`);
            await supabase.from("generated_contracts").update({ pdf_url: publicUrl }).eq("id", contract.id);
          }
        } catch (pdfErr) {
          console.error("Failed to generate/upload contract PDF (non-blocking):", pdfErr);
        }

      }
      
      // Clear any pending onboarding from localStorage
      localStorage.removeItem("pending_onboarding_franchisee");
      
      toast.success("Contract signed successfully!");
      
      // Navigate to confirmation page
      navigate(`/confirmation?franchisee_id=${franchiseeId}`);
    },
    onError: (error: Error) => {
      console.error("Error signing contract:", error);
      toast.error(error.message || "Failed to sign contract. Please try again.");
    },
  });

  const handleSubmit = async () => {
    if (!signatureData) {
      toast.error("Please sign the contract");
      return;
    }

    if (!agreedToTerms || !acknowledgedReview) {
      toast.error("Please check all required boxes");
      return;
    }

    setIsSubmitting(true);
    try {
      await createContractMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (franchiseeId) {
      navigate(`/onboarding?franchisee_id=${franchiseeId}`);
    } else {
      navigate(`/onboarding?plan_id=${franchisee?.plan_id}&brand_id=${franchisee?.brand_id}`);
    }
  };

  const isLoading = franchiseeLoading || templateLoading;

  if (isLoading) {
    return (
      <PortalLayout ref={ref}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  if (!template) {
    return (
      <PortalLayout ref={ref}>
        <div className="content-max px-4 py-8">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Contract Template Found</h2>
              <p className="text-muted-foreground text-center mb-4">
                Please contact support to set up a contract template.
              </p>
              <Button variant="outline" onClick={() => navigate("/select-brand")}>
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout ref={ref}>
      <div className="content-max px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Onboarding
          </Button>
          
          <h1 className="text-page-title text-foreground mb-2">
            Review & Sign Contract
          </h1>
          <p className="text-body text-muted-foreground">
            Please review the contract below carefully, then sign to proceed
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contract Viewer */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Statement of Work
                </CardTitle>
                <CardDescription>
                  {template.name} (v{template.version})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContractViewer htmlContent={processedContract} />
              </CardContent>
            </Card>
          </div>

          {/* Signature Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Summary Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Contract Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Franchisee:</span>
                    <span className="font-medium">{franchisee?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand:</span>
                    <span className="font-medium">{franchisee?.brands?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="font-medium">{franchisee?.plans?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly:</span>
                    <span className="font-medium text-primary">
                      ${franchisee?.plans?.monthly_price?.toLocaleString()}
                    </span>
                  </div>
                  {franchisee?.include_paid_media && (
                    <div className="pt-2 border-t">
                      <span className="text-primary font-medium">+ Paid Media Services</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Signature Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-primary" />
                    Your Signature
                  </CardTitle>
                  <CardDescription>
                    Sign below to agree to the terms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <SignaturePad
                    onSignatureChange={setSignatureData}
                    signerName={
                      (franchisee?.location_details as Record<string, string>)?.firstName 
                        ? `${(franchisee?.location_details as Record<string, string>).firstName} ${(franchisee?.location_details as Record<string, string>).lastName}`
                        : ""
                    }
                    disabled={isSubmitting}
                  />

                  {/* Acknowledgments */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="reviewAck"
                        checked={acknowledgedReview}
                        onCheckedChange={(checked) => setAcknowledgedReview(checked === true)}
                        disabled={isSubmitting}
                      />
                      <Label
                        htmlFor="reviewAck"
                        className="text-sm leading-relaxed cursor-pointer"
                      >
                        I have read and reviewed the entire contract document above
                      </Label>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="termsAck"
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        disabled={isSubmitting}
                      />
                      <Label
                        htmlFor="termsAck"
                        className="text-sm leading-relaxed cursor-pointer"
                      >
                        I agree to the terms and conditions outlined in this contract
                      </Label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !signatureData || !agreedToTerms || !acknowledgedReview}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        Sign & Submit
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
});

ContractReview.displayName = "ContractReview";

export default ContractReview;
