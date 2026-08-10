import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/contract/SignaturePad";
import { ContractViewer } from "@/components/contract/ContractViewer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, PenLine, FileText, Eye, Download, RefreshCw } from "lucide-react";
import { activityLogger } from "@/lib/activityLogger";
import { format } from "date-fns";
import { insertSignatureImages, generateContractPDF } from "@/lib/pdfGenerator";

interface ContractCounterSignProps {
  open: boolean;
  onClose: () => void;
  contract: {
    id: string;
    franchisee_id: string;
    final_html: string;
    status: string;
    franchisee_signature?: string | null;
    franchisee_signed_at?: string | null;
    counter_signature?: string | null;
    counter_signed_at?: string | null;
    pdf_url?: string | null;
    signed_pdf_url?: string | null;
    contract_templates?: { name: string; version: string };
  } | null;
  franchiseeName: string;
}

export function ContractCounterSign({
  open,
  onClose,
  contract,
  franchiseeName,
}: ContractCounterSignProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [signature, setSignature] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = () => {
    if (!contract) return;
    const url = contract.signed_pdf_url || contract.pdf_url;
    if (url) window.open(url, "_blank");
  };

  const handleRegeneratePdf = async () => {
    if (!contract) return;
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateContractPDF(processedHtml, `${contract.id}-signed.pdf`);
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(`${contract.id}-signed.pdf`, pdfBlob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(`${contract.id}-signed.pdf`);
      await supabase.from("generated_contracts").update({ signed_pdf_url: publicUrl }).eq("id", contract.id);
      queryClient.invalidateQueries({ queryKey: ["franchisee-contracts"] });
      toast({ title: "PDF Regenerated", description: "The stored PDF has been updated." });
      // Cache-bust so the browser loads the new file instead of a cached 174-page PDF
      const urlWithCacheBust = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      window.open(urlWithCacheBust, "_blank");
    } catch (error) {
      toast({ title: "Error", description: "Failed to regenerate PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const counterSignMutation = useMutation({
    mutationFn: async () => {
      if (!contract || !signature) {
        throw new Error("Missing contract or signature");
      }

      // Generate and upload the fully-signed PDF before updating status so that
      // signed_pdf_url is already populated when the DB trigger fires the webhook.
      let signedPdfUrl: string | undefined;
      try {
        const signedHtml = insertSignatureImages(
          contract.final_html,
          contract.franchisee_signature || null,
          signature,
          contract.franchisee_signed_at ? format(new Date(contract.franchisee_signed_at), "MMMM d, yyyy") : null,
          format(new Date(), "MMMM d, yyyy")
        );
        const pdfBlob = await generateContractPDF(signedHtml, `${contract.id}-signed.pdf`);
        const { error: uploadError } = await supabase.storage
          .from("contracts")
          .upload(`${contract.id}-signed.pdf`, pdfBlob, { contentType: "application/pdf", upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(`${contract.id}-signed.pdf`);
          signedPdfUrl = publicUrl;
        }
      } catch (pdfErr) {
        console.error("Failed to generate/upload signed PDF (non-blocking):", pdfErr);
      }

      // Update status last — the DB trigger fires here and sends the webhook.
      const { error } = await supabase
        .from("generated_contracts")
        .update({
          counter_signature: signature,
          counter_signed_at: new Date().toISOString(),
          status: "fully_signed",
          ...(signedPdfUrl ? { signed_pdf_url: signedPdfUrl } : {}),
        })
        .eq("id", contract.id);

      if (error) throw error;

      // Mark the franchisee as completed now that both parties have signed
      const { error: franchiseeError } = await supabase
        .from("franchisees")
        .update({ status: "completed" })
        .eq("id", contract.franchisee_id);

      if (franchiseeError) {
        console.error("Failed to update franchisee status:", franchiseeError);
      }

    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["franchisee-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-countersign"] });
      queryClient.invalidateQueries({ queryKey: ["franchisee"] });
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      if (contract?.id) {
        await activityLogger.logActivity('contract_countersigned', 'contract', contract.id, { 
          franchisee_name: franchiseeName 
        });
      }
      toast({
        title: "Contract Signed",
        description: "The contract has been counter-signed successfully.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!contract) return null;

  const isAlreadySigned = contract.status === "fully_signed";
  const isPendingCounterSign = contract.status === "signed_by_franchisee";

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="flex h-[min(88dvh,100dvh)] max-h-[min(88dvh,100dvh)] min-h-0 min-w-0 max-w-2xl flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isAlreadySigned ? "View Signed Contract" : "Counter-Sign Contract"}
            </DialogTitle>
            <DialogDescription>
              {contract.contract_templates?.name} v{contract.contract_templates?.version}
              {" • "}Franchisee: {franchiseeName}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] -mx-4 px-4 sm:-mx-6 sm:px-6">
            <div className="space-y-6 py-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <Badge
                  variant={isAlreadySigned ? "default" : "secondary"}
                  className={isAlreadySigned ? "bg-green-500/10 text-green-600" : ""}
                >
                  {isAlreadySigned ? "Fully Signed" : "Pending Counter-Signature"}
                </Badge>
              </div>

              {/* Franchisee Signature Info */}
              {contract.franchisee_signature && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">Franchisee Signature</p>
                        <p className="text-xs text-muted-foreground">
                          Signed on{" "}
                          {contract.franchisee_signed_at
                            ? format(new Date(contract.franchisee_signed_at), "MMMM d, yyyy 'at' h:mm a")
                            : "N/A"}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="mt-3 p-2 bg-muted/30 rounded-md">
                      <img
                        src={contract.franchisee_signature}
                        alt="Franchisee signature"
                        className="max-h-16 object-contain"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Counter Signature (if exists) */}
              {contract.counter_signature && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">Authorized Representative Signature</p>
                        <p className="text-xs text-muted-foreground">
                          Signed on{" "}
                          {contract.counter_signed_at
                            ? format(new Date(contract.counter_signed_at), "MMMM d, yyyy 'at' h:mm a")
                            : "N/A"}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="mt-3 p-2 bg-muted/30 rounded-md">
                      <img
                        src={contract.counter_signature}
                        alt="Counter signature"
                        className="max-h-16 object-contain"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Counter-Sign Section (only if pending) */}
              {isPendingCounterSign && !contract.counter_signature && (
                <Card className="border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <PenLine className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Your Signature</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sign below to complete the contract signing process.
                    </p>
                    <div className="border rounded-md p-2">
                      <SignaturePad onSignatureChange={setSignature} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* View Contract Button */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="w-full gap-2 sm:flex-1 sm:w-auto"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="h-4 w-4" />
                  View Full Contract
                </Button>
                {isAlreadySigned && (contract.signed_pdf_url || contract.pdf_url) && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    onClick={handleDownloadPdf}
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                )}
                {isAlreadySigned && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    onClick={handleRegeneratePdf}
                    disabled={isGeneratingPdf}
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Regenerate PDF
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={onClose}>
              {isAlreadySigned ? "Close" : "Cancel"}
            </Button>
            {isPendingCounterSign && !contract.counter_signature && (
              <Button
                onClick={() => counterSignMutation.mutate()}
                disabled={!signature || counterSignMutation.isPending}
                className="gap-2"
              >
                {counterSignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <PenLine className="h-4 w-4" />
                    Counter-Sign Contract
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="flex h-[min(92dvh,100dvh)] max-h-[min(92dvh,100dvh)] min-h-0 min-w-0 max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Contract Preview</DialogTitle>
            <DialogDescription>
              Contract with signatures
            </DialogDescription>
          </DialogHeader>
          <ContractViewer
            variant="modal"
            htmlContent={contract?.final_html || ""}
            franchiseeSignature={contract?.franchisee_signature}
            counterSignature={contract?.counter_signature}
            franchiseeSignedAt={contract?.franchisee_signed_at}
            counterSignedAt={contract?.counter_signed_at}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
