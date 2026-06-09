import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Send, Loader2 } from "lucide-react";
import { generateContractPDF, insertSignatureImages, sanitizeContractHtml, getContractPreviewStyles, CONTRACT_PREVIEW_CONTENT_CLASS, PREVIEW_CONTENT_WIDTH_PX, constrainImagesInHtml } from "@/lib/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ContractPreviewProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
  templateName: string;
  franchiseeName?: string;
  franchiseeSignature?: string | null;
  counterSignature?: string | null;
  franchiseeSignedAt?: string | null;
  counterSignedAt?: string | null;
}

export function ContractPreview({
  open,
  onClose,
  htmlContent,
  templateName,
  franchiseeName,
  franchiseeSignature,
  counterSignature,
  franchiseeSignedAt,
  counterSignedAt,
}: ContractPreviewProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfStyleHostRef = useRef<HTMLDivElement | null>(null);

  // Process the HTML: insert signatures, then strip any unreplaced placeholders/markers
  const processedHtml = sanitizeContractHtml(
    insertSignatureImages(
      htmlContent,
      franchiseeSignature || null,
      counterSignature || null,
      franchiseeSignedAt ? format(new Date(franchiseeSignedAt), "MMMM d, yyyy") : null,
      counterSignedAt ? format(new Date(counterSignedAt), "MMMM d, yyyy") : null
    )
  );
  // Constrain images so they fit on the page and don't overlap text (preview + PDF)
  const previewHtml = constrainImagesInHtml(processedHtml);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const fileName = franchiseeName
        ? `${templateName}-${franchiseeName}.pdf`
        : `${templateName}.pdf`;
      
      const pdfBlob = await generateContractPDF(processedHtml, fileName, pdfStyleHostRef.current ?? undefined);
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      toast({
        title: "PDF Generated",
        description: "PDF opened in a new tab.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToFranchisee = () => {
    toast({
      title: "Coming Soon",
      description: "Email sending functionality will be available soon.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(92dvh,100dvh)] max-h-[min(92dvh,100dvh)] min-h-0 min-w-0 max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
        {/* Hidden host so PDF is rendered with the same styles as the preview (same document, same CSS). */}
        <div
          ref={pdfStyleHostRef}
          aria-hidden
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            width: PREVIEW_CONTENT_WIDTH_PX,
            zIndex: -1,
            overflow: 'visible',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: getContractPreviewStyles(processedHtml) }} />
        </div>
        <DialogHeader className="min-w-0 shrink-0 space-y-3 pr-8 text-left">
          <DialogTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="break-words">Contract Preview</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendToFranchisee}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Send to Franchisee
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border [-webkit-overflow-scrolling:touch]">
          <style dangerouslySetInnerHTML={{ __html: getContractPreviewStyles(processedHtml) }} />
          <div
            className={`${CONTRACT_PREVIEW_CONTENT_CLASS} min-w-0 max-w-full bg-white`}
            style={{
              padding: "16px",
              width: "100%",
              maxWidth: PREVIEW_CONTENT_WIDTH_PX,
              margin: "0 auto",
              boxSizing: "border-box",
              overflowX: "hidden",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#1a1a1a",
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
