import { useRef, useState, useEffect, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eraser, Check, PenTool, Type } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  signerName?: string;
  disabled?: boolean;
}

export const SignaturePad = forwardRef<HTMLDivElement, SignaturePadProps>(function SignaturePad(
  { onSignatureChange, signerName = "", disabled = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(signerName);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set drawing style
    ctx.strokeStyle = "#1a365d";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    setLastPoint(point);
  }, [disabled, getPoint]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPoint) return;

    const point = getPoint(e);
    if (!point) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    setLastPoint(point);
    setHasSignature(true);
  }, [isDrawing, disabled, lastPoint, getPoint]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && hasSignature) {
      const canvas = canvasRef.current;
      if (canvas) {
        const signatureData = canvas.toDataURL("image/png");
        onSignatureChange(signatureData);
      }
    }
    setIsDrawing(false);
    setLastPoint(null);
  }, [isDrawing, hasSignature, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    setHasSignature(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  const generateTypedSignature = useCallback(() => {
    if (!typedName.trim()) {
      onSignatureChange(null);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 100);

    // Signature style font
    ctx.font = "italic 32px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.fillStyle = "#1a365d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 200, 50);

    const signatureData = canvas.toDataURL("image/png");
    onSignatureChange(signatureData);
  }, [typedName, onSignatureChange]);

  useEffect(() => {
    if (signatureType === "type") {
      generateTypedSignature();
    }
  }, [typedName, signatureType, generateTypedSignature]);

  return (
    <div ref={ref} className="space-y-4">
      <Tabs 
        value={signatureType} 
        onValueChange={(v) => {
          setSignatureType(v as "draw" | "type");
          if (v === "draw") {
            clearSignature();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" disabled={disabled}>
            <PenTool className="h-4 w-4 mr-2" />
            Draw Signature
          </TabsTrigger>
          <TabsTrigger value="type" disabled={disabled}>
            <Type className="h-4 w-4 mr-2" />
            Type Signature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-4">
          <div className="space-y-3">
            <div 
              className={`relative border-2 rounded-lg overflow-hidden ${
                disabled ? "opacity-50 cursor-not-allowed" : "border-dashed border-muted-foreground/30"
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-32 touch-none cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              
              {!hasSignature && !disabled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground text-sm">
                    Sign here
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                disabled={disabled || !hasSignature}
              >
                <Eraser className="h-4 w-4 mr-2" />
                Clear
              </Button>

              {hasSignature && (
                <span className="text-sm text-primary flex items-center">
                  <Check className="h-4 w-4 mr-1" />
                  Signature captured
                </span>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="typedSignature">Type your full name</Label>
              <Input
                id="typedSignature"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="John Doe"
                disabled={disabled}
                className="text-lg"
              />
            </div>

            {typedName && (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                <p 
                  className="text-2xl text-center text-primary"
                  style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontStyle: "italic" }}
                >
                  {typedName}
                </p>
              </div>
            )}

            {typedName && (
              <span className="text-sm text-primary flex items-center justify-end">
                <Check className="h-4 w-4 mr-1" />
                Signature ready
              </span>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        By signing, you acknowledge that this electronic signature is legally binding.
      </p>
    </div>
  );
});
