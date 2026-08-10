import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { insertSignatureImages, sanitizeContractHtml, getContractPreviewStyles, CONTRACT_PREVIEW_CONTENT_CLASS } from "@/lib/pdfGenerator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/** Native scroll — reliable inside dialogs on iOS (Radix ScrollArea often traps or clips touch scroll). */
const contractScrollClass =
  "overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]";

interface ContractViewerProps {
  htmlContent: string;
  className?: string;
  /** `embedded`: card / page (capped height). `modal`: fills dialog body — parent must be flex + min-h-0 + flex-1. */
  variant?: "embedded" | "modal";
  franchiseeSignature?: string | null;
  counterSignature?: string | null;
  franchiseeSignedAt?: string | null;
  counterSignedAt?: string | null;
}

export function ContractViewer({
  htmlContent,
  className = "",
  variant = "embedded",
  franchiseeSignature,
  counterSignature,
  franchiseeSignedAt,
  counterSignedAt,
}: ContractViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const processedHtml = useMemo(() => {
    const withSignatures = insertSignatureImages(
      htmlContent,
      franchiseeSignature || null,
      counterSignature || null,
      franchiseeSignedAt ? format(new Date(franchiseeSignedAt), "MMMM d, yyyy") : null,
      counterSignedAt ? format(new Date(counterSignedAt), "MMMM d, yyyy") : null,
    );
    return sanitizeContractHtml(withSignatures);
  }, [htmlContent, franchiseeSignature, counterSignature, franchiseeSignedAt, counterSignedAt]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 70));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const isModal = variant === "modal";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border bg-background",
        isModal ? "h-full min-h-0 max-h-full min-w-0 flex-1" : "min-w-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 sm:px-4">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">Contract Document</span>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={handleZoomOut} disabled={zoom <= 70}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-muted-foreground sm:min-w-[4rem] sm:text-sm">{zoom}%</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={handleZoomIn} disabled={zoom >= 150}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          contractScrollClass,
          isModal
            ? "min-h-0 flex-1"
            : "max-h-[min(32rem,calc(100dvh-14rem))] min-h-[200px] sm:min-h-[240px]",
        )}
      >
        <div
          className="bg-white px-4 py-6 sm:px-6 sm:py-8"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
            minHeight: isFullscreen ? "100vh" : undefined,
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: getContractPreviewStyles(processedHtml) }} />
          <div
            className={`${CONTRACT_PREVIEW_CONTENT_CLASS} mx-auto max-w-full min-w-0 sm:max-w-[800px]`}
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t bg-muted/30 px-3 py-2 sm:px-4">
        <p className="text-center text-[10px] text-muted-foreground sm:text-xs">
          Please read the entire contract before signing. Scroll down to continue.
        </p>
      </div>
    </div>
  );
}
