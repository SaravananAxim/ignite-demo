import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, FileText, CreditCard, Calendar, Mail, Phone, Download, ArrowRight } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { ONBOARDING_STEP, type OnboardingStep } from "@/types/franchisee";
import { clearPendingOnboarding } from "@/hooks/useOnboardingResume";

export default function Confirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const franchiseeId = searchParams.get("franchisee_id");

  // Fetch franchisee details
  const { data: franchisee, isLoading } = useQuery({
    queryKey: ["franchisee-confirmation", franchiseeId],
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

  // Fetch generated contract
  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ["generated-contract", franchiseeId],
    queryFn: async () => {
      if (!franchiseeId) return null;
      const { data, error } = await supabase
        .from("generated_contracts")
        .select("*")
        .eq("franchisee_id", franchiseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!franchiseeId,
  });

  // Combined loading state - don't redirect until all data is loaded
  const isFullyLoaded = !isLoading && !contractLoading;

  // Determine the correct page to redirect to based on onboarding step
  // IMPORTANT: If franchisee has signed (has signature_data), they are DONE - don't redirect
  const getResumeRoute = (step: OnboardingStep | string | null): string | null => {
    // If franchisee has already signed, they are complete - no redirect
    if (franchisee?.signature_data) {
      return null;
    }

    // Check payment status - if they have paid/authorized/trialing, they completed checkout
    const hasCompletedPayment = franchisee?.payment_status && 
      ['paid', 'authorized', 'trialing', 'pending_checkout'].includes(franchisee.payment_status);
    
    switch (step) {
      case ONBOARDING_STEP.PAYMENT:
        // If they're on payment step but have completed payment, move to intake
        if (hasCompletedPayment) {
          return `/onboarding?franchisee_id=${franchiseeId}`;
        }
        // Otherwise they need to pay first
        return `/payment-processing?franchisee_id=${franchiseeId}`;
      case ONBOARDING_STEP.INTAKE:
        return `/onboarding?franchisee_id=${franchiseeId}`;
      case ONBOARDING_STEP.REPRESENTATIVES:
        return `/representatives?franchisee_id=${franchiseeId}`;
      case ONBOARDING_STEP.CONTRACT:
        return `/contract-review?franchisee_id=${franchiseeId}`;
      case ONBOARDING_STEP.COMPLETE:
        return null; // Stay on confirmation
      default:
        // Fallback: check for incomplete data
        // If they have placeholder data but have paid, they need to complete intake
        if (franchisee?.email === 'pending@temp.local' || franchisee?.name === 'Pending Registration') {
          if (hasCompletedPayment) {
            return `/onboarding?franchisee_id=${franchiseeId}`;
          }
          // No payment yet - go to payment
          return `/payment-processing?franchisee_id=${franchiseeId}`;
        }
        if (!contract) {
          // No contract but data is filled - check where they are in the flow
          if (franchisee?.onboarding_step === 'representatives' || franchisee?.campaign_rep_name) {
            return `/contract-review?franchisee_id=${franchiseeId}`;
          }
          return `/representatives?franchisee_id=${franchiseeId}`;
        }
        return null;
    }
  };

  // Check if onboarding is incomplete and redirect appropriately
  // IMPORTANT: Wait until ALL queries are loaded before making redirect decisions
  useEffect(() => {
    if (isFullyLoaded && franchisee && franchiseeId) {
      const resumeRoute = getResumeRoute(franchisee.onboarding_step);
      
      if (resumeRoute) {
        toast.success("Let's continue where you left off!");
        navigate(resumeRoute);
      }
    }
  }, [isFullyLoaded, franchisee, franchiseeId, contract, navigate]);

  // Redirect if no franchisee ID
  useEffect(() => {
    if (!franchiseeId && isFullyLoaded) {
      toast.error("Missing franchisee information");
      navigate("/select-brand");
    }
  }, [franchiseeId, isFullyLoaded, navigate]);

  if (!isFullyLoaded) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  // If we're still here (not redirected), check if we need to show resume UI
  const resumeRoute = getResumeRoute(franchisee?.onboarding_step);
  
  if (resumeRoute) {
    return (
      <PortalLayout>
        <div className="content-max px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-page-title text-foreground mb-2">
                Payment Verified!
              </h1>
              <p className="text-body text-muted-foreground">
                Let's complete your registration.
              </p>
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate(resumeRoute)}
                >
                  Continue Registration
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // Onboarding is complete - clear the pending storage
  clearPendingOnboarding();

  const locationDetails = franchisee?.location_details as Record<string, string> || {};

  return (
    <PortalLayout>
      <div className="content-max px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-page-title text-foreground mb-2">
              You're All Set!
            </h1>
            <p className="text-body text-muted-foreground">
              Your subscription has been set up successfully. 
              Welcome to {(franchisee?.brands as any)?.name || "our network"}!
            </p>
          </div>

          {/* Confirmation Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Confirmation Details</CardTitle>
              <CardDescription>
                Here's a summary of your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Brand and Plan */}
              <div className="flex items-center gap-4 pb-4 border-b">
                {(franchisee?.brands as any)?.logo_url && (
                  <img
                    src={(franchisee?.brands as any).logo_url}
                    alt={(franchisee?.brands as any).name}
                    className="h-12 w-auto object-contain"
                  />
                )}
                <div>
                  <p className="font-semibold text-lg">{franchisee?.name}</p>
                  <p className="text-muted-foreground">{(franchisee?.brands as any)?.name}</p>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Plan
                  </p>
                  <p className="font-medium">{(franchisee?.plans as any)?.name}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Monthly Fee
                  </p>
                  <p className="font-medium">
                    ${(franchisee?.plans as any)?.monthly_price?.toLocaleString()}/month
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Service Start Date
                  </p>
                  <p className="font-medium">
                    {franchisee?.service_start_date
                      ? new Date(franchisee.service_start_date + "T00:00:00").toLocaleDateString()
                      : "To be confirmed"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Billing Day
                  </p>
                  <p className="font-medium">
                    {(franchisee?.plans as any)?.billing_anchor_day || 15}th of each month
                  </p>
                </div>
              </div>

              {franchisee?.include_paid_media && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="font-medium text-primary">
                    ✓ Paid Media Services Included
                  </p>
                </div>
              )}

              {/* Contact Information */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Contact Information</p>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {franchisee?.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {franchisee?.business_phone || franchisee?.phone}
                  </p>
                </div>
              </div>

              {/* Contract Status */}
              {contract && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Contract Status</p>
                      <p className="text-sm text-muted-foreground">
                        {contract.status === "signed_by_franchisee" 
                          ? "Awaiting counter-signature"
                          : contract.status === "fully_signed"
                          ? "Fully executed"
                          : contract.status}
                      </p>
                    </div>
                    {contract.signed_pdf_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={contract.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">What's Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>
                    <strong>Contract Counter-Signature:</strong> Our team will review and 
                    counter-sign your contract within 1-2 business days.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>
                    <strong>Onboarding Call:</strong> You'll receive an email to schedule 
                    your kickoff call with our team.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>
                    <strong>Service Activation:</strong> Your marketing services will begin 
                    on your selected start date.
                  </span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Support Info */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Questions? Contact us at{" "}
              <a href="mailto:support@ignitevisibility.com" className="text-primary hover:underline">
                support@ignitevisibility.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
