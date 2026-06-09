import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContractTemplateRow } from "@/types/contract";
import { replacePlaceholders, sanitizeContractHtml } from "@/lib/pdfGenerator";
import { ContractPreview } from "./ContractPreview";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface GenerateContractModalProps {
  open: boolean;
  onClose: () => void;
  template: ContractTemplateRow | null;
}

export function GenerateContractModal({
  open,
  onClose,
  template,
}: GenerateContractModalProps) {
  const [selectedFranchiseeId, setSelectedFranchiseeId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch real franchisees from database
  const { data: franchisees, isLoading: loadingFranchisees } = useQuery({
    queryKey: ["franchisees-for-contract"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisees")
        .select("*, brands(*), plans(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedFranchisee = franchisees?.find(f => f.id === selectedFranchiseeId);

  // Build placeholder values from selected franchisee
  const placeholderValues = useMemo(() => {
    if (!selectedFranchisee) return {};
    
    const f = selectedFranchisee;
    const locationDetails = (f.location_details as Record<string, string>) || {};
    const plan = f.plans as any;
    const brand = f.brands as any;

    // Calculate pricing
    const monthlyPrice = plan?.monthly_price || 0;
    const paidMediaFee = plan?.monthly_price_with_media || 0;
    const setupFee = plan?.setup_fee || 0;
    const totalMonthly = f.include_paid_media ? monthlyPrice + paidMediaFee : monthlyPrice;

    // Build full address
    const fullAddress = [
      locationDetails.streetAddress,
      locationDetails.city,
      locationDetails.state,
      locationDetails.zipCode
    ].filter(Boolean).join(", ");

    return {
      // Business Information
      legalBusinessName: f.legal_business_name || "",
      legalEntity: f.legal_entity || "",
      franchiseLocationName: f.franchise_location_name || "",
      
      // Contact Person
      firstName: locationDetails.firstName || "",
      lastName: locationDetails.lastName || "",
      fullName: [locationDetails.firstName, locationDetails.lastName].filter(Boolean).join(" ") || f.name || "",
      email: f.email || "",
      positionTitle: f.position_title || "",
      businessPhone: f.business_phone || "",
      cellPhone: f.cell_phone || "",
      
      // Address
      streetAddress: locationDetails.streetAddress || f.address || "",
      city: locationDetails.city || "",
      state: locationDetails.state || "",
      zipCode: locationDetails.zipCode || "",
      fullAddress: fullAddress || f.address || "",
      
      // Brand & Plan
      brandName: brand?.name || "",
      portalName: "Ignite Visibility",
      planName: plan?.name || "",
      monthlyPrice: `$${monthlyPrice.toLocaleString()}`,
      setupFee: setupFee ? `$${setupFee.toLocaleString()}` : "$0",
      paidMediaFee: paidMediaFee ? `$${paidMediaFee.toLocaleString()}` : "$0",
      paid_media_budget: f.paid_media_budget || "",
      totalMonthlyPrice: `$${totalMonthly.toLocaleString()}`,
      
      // Dates
      // Append 'T00:00:00' to date-only strings so JS parses them as local time, not UTC
      effectiveDate: f.service_start_date
        ? format(new Date(f.service_start_date + "T00:00:00"), "MMMM d, yyyy")
        : format(new Date(), "MMMM d, yyyy"),
      signatureDate: format(new Date(), "MMMM d, yyyy"),
      currentDate: format(new Date(), "MMMM d, yyyy"),
      grandOpeningDate: f.grand_opening_date
        ? format(new Date(f.grand_opening_date + "T00:00:00"), "MMMM d, yyyy")
        : "",
      
      // Representatives
      campaignRepName: f.campaign_rep_name || "",
      campaignRepEmail: f.campaign_rep_email || "",
      campaignRepPhone: f.campaign_rep_phone || "",
      billingRepName: f.billing_rep_name || "",
      billingRepEmail: f.billing_rep_email || "",
      billingRepPhone: f.billing_rep_phone || "",
      
      // Signature placeholders intentionally omitted — preserved by sanitizeContractHtml
      // and replaced by insertSignatureImages at display/PDF time.

      // Legacy placeholders
      franchiseeName: f.name || "",
      franchiseeEmail: f.email || "",
      franchiseeAddress: fullAddress || f.address || "",
    };
  }, [selectedFranchisee]);

  // Generate HTML with conditionals handled
  const generatedHtml = useMemo(() => {
    if (!template || !selectedFranchisee) return "";
    const includePaidMedia = selectedFranchisee.include_paid_media === true;
    const isNewLocation = selectedFranchisee.is_new_location === true;

    let html = template.html_content;

    // Normalize entity-encoded markers to {{}} so we can strip both formats
    html = html
      .replace(/&lt;!--\s*section_PaidMedia\s*--&gt;/gi, "{{#section:PaidMedia}}")
      .replace(/&lt;!--\s*\/section_PaidMedia\s*--&gt;/gi, "{{/section:PaidMedia}}")
      .replace(/&lt;!--\s*section_NewLocation\s*--&gt;/gi, "{{#section:NewLocation}}")
      .replace(/&lt;!--\s*\/section_NewLocation\s*--&gt;/gi, "{{/section:NewLocation}}");

    // Handle conditional Paid Media: only show section when explicitly true
    if (!includePaidMedia) {
      html = html.replace(/\{\{#section:PaidMedia\}\}[\s\S]*?\{\{\/section:PaidMedia\}\}/gi, "");
      html = html.replace(/<!--\s*section_PaidMedia\s*-->[\s\S]*?<!--\s*\/section_PaidMedia\s*-->/gi, "");
    } else {
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
  }, [template, selectedFranchisee, placeholderValues]);

  const handleClose = () => {
    setSelectedFranchiseeId("");
    setShowPreview(false);
    onClose();
  };

  if (showPreview && template && selectedFranchisee) {
    return (
      <ContractPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        htmlContent={generatedHtml}
        templateName={template.name}
        franchiseeName={selectedFranchisee.name}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[min(85vh,100dvh)] min-w-0 max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Contract Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Info */}
          {template && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="font-medium">{template.name}</p>
              <p className="text-sm text-muted-foreground">Version {template.version}</p>
            </div>
          )}

          {/* Franchisee Selection */}
          <div className="space-y-2">
            <Label htmlFor="franchisee">Select Franchisee</Label>
            {loadingFranchisees ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading franchisees...
              </div>
            ) : franchisees && franchisees.length > 0 ? (
              <Select value={selectedFranchiseeId} onValueChange={setSelectedFranchiseeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a franchisee..." />
                </SelectTrigger>
                <SelectContent>
                  {franchisees.map((franchisee) => (
                    <SelectItem key={franchisee.id} value={franchisee.id}>
                      <div className="flex flex-col">
                        <span>{franchisee.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {franchisee.email} • {(franchisee.brands as any)?.name || "No brand"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No franchisees found. Franchisees are created when they sign up through a portal.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Preview of what will be replaced */}
          {selectedFranchisee && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Data Preview</Label>
              <div className="grid grid-cols-1 gap-2 text-sm p-4 bg-muted/30 rounded-lg max-h-[200px] overflow-y-auto sm:grid-cols-2">
                <div><span className="text-muted-foreground">Name:</span> {selectedFranchisee.name}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedFranchisee.email}</div>
                <div><span className="text-muted-foreground">Brand:</span> {(selectedFranchisee.brands as any)?.name || "—"}</div>
                <div><span className="text-muted-foreground">Plan:</span> {(selectedFranchisee.plans as any)?.name || "—"}</div>
                <div><span className="text-muted-foreground">Paid Media:</span> {selectedFranchisee.include_paid_media ? "Yes" : "No"}</div>
                <div><span className="text-muted-foreground">New Location:</span> {selectedFranchisee.is_new_location ? "Yes" : "No"}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => setShowPreview(true)}
            disabled={!selectedFranchiseeId}
          >
            Generate Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
