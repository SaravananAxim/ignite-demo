import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { ContractTemplateRow, ALL_PLACEHOLDER_GROUPS, SECTION_MARKERS, KNOWN_PLACEHOLDER_KEYS } from "@/types/contract";
import { ChevronDown, Save, X, FileCode, Info, Eye, Upload, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlertTriangle } from "lucide-react";
import { activityLogger } from "@/lib/activityLogger";
import { importGoogleDocsZip } from "@/lib/importGoogleDocsZip";
import { splitLeadingStyleBlock } from "@/lib/contractHtmlUtils";
import { constrainImagesInHtml } from "@/lib/pdfGenerator";

const PAGE_BREAK_HTML = '<div class="pdf-page-break" data-page-break="true" contenteditable="false"><span class="pdf-page-break-label">— Page break —</span></div>';

interface ContractTemplateEditorProps {
  open: boolean;
  onClose: () => void;
  template: ContractTemplateRow | null;
}

export function ContractTemplateEditor({
  open,
  onClose,
  template,
}: ContractTemplateEditorProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const lastExternalHtmlRef = useRef<string | null>(null);
  const styleBlockRef = useRef<string>("");

  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [htmlContent, setHtmlContent] = useState("");
  const [activeTab, setActiveTab] = useState("edit");

  // Reset form when template changes (prod-safe: same html_content load)
  useEffect(() => {
    if (template) {
      setName(template.name);
      setVersion(template.version);
      setHtmlContent(template.html_content);
      lastExternalHtmlRef.current = template.html_content;
    } else {
      setName("");
      setVersion("1.0");
      setHtmlContent("");
      lastExternalHtmlRef.current = null;
    }
  }, [template, open]);

  // Sync external HTML (template load, import) into contenteditable so we don't overwrite while typing.
  // If content has a leading <style> block (e.g. Google Docs import), only the body is editable; style is kept in a ref.
  useEffect(() => {
    const el = editorRef.current;
    if (activeTab !== "edit" || !el || htmlContent !== lastExternalHtmlRef.current) return;
    const { styleBlock, body } = splitLeadingStyleBlock(htmlContent);
    styleBlockRef.current = styleBlock;
    const contentToShow = body || htmlContent;
    if (el.innerHTML !== contentToShow) {
      el.innerHTML = contentToShow;
    }
  }, [activeTab, htmlContent]);

  // Extract placeholders from content
  const extractPlaceholders = (content: string): string[] => {
    const matches = content.match(/\{\{[^}]+\}\}/g);
    return matches ? [...new Set(matches)] : [];
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const placeholders = extractPlaceholders(htmlContent);

      if (template) {
        // Update existing
        const { data: updated, error } = await supabase
          .from("contract_templates")
          .update({
            name,
            version,
            html_content: htmlContent,
            placeholders,
            updated_by: user?.id ?? null,
          })
          .eq("id", template.id)
          .select("id, name")
          .single();

        if (error) throw error;
        return { isNew: false, data: updated };
      } else {
        // Create new
        const { data: created, error } = await supabase.from("contract_templates").insert({
          name,
          version,
          html_content: htmlContent,
          placeholders,
          updated_by: user?.id ?? null,
        }).select("id, name").single();

        if (error) throw error;
        return { isNew: true, data: created };
      }
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      queryClient.invalidateQueries({ queryKey: ["contract-templates-list"] });
      if (result?.data) {
        if (result.isNew) {
          await activityLogger.templateCreated(result.data.id, { name: result.data.name });
        } else {
          await activityLogger.templateUpdated(result.data.id, { name: result.data.name });
        }
      }
      toast({
        title: template ? "Template updated" : "Template created",
        description: `"${name}" has been saved successfully.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const insertAtSelection = (htmlOrText: string, isHtml: boolean) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    let range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const inEditor = range && el.contains(range.commonAncestorContainer);
    if (!inEditor) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    if (isHtml) {
      const fragment = document.createRange().createContextualFragment(htmlOrText);
      range!.deleteContents();
      range!.insertNode(fragment);
    } else {
      document.execCommand("insertText", false, htmlOrText);
    }
    setHtmlContent(styleBlockRef.current + el.innerHTML);
  };

  const insertPlaceholder = (placeholder: string) => {
    insertAtSelection(placeholder, false);
  };

  const insertSection = (startMarker: string, endMarker: string, label: string) => {
    const sectionContent = `\n${startMarker}\n[${label} content - only shown when applicable]\n${endMarker}\n`;
    insertAtSelection(sectionContent, false);
  };

  const insertPageBreak = () => {
    insertAtSelection(PAGE_BREAK_HTML, true);
  };

  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    if (editorRef.current) setHtmlContent(styleBlockRef.current + editorRef.current.innerHTML);
  };

  const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE"]);

  const getBlockElement = (node: Node | null): HTMLElement | null => {
    const el = editorRef.current;
    if (!el) return null;
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName)) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  /** All block elements that intersect the current selection (single block or multi-select). */
  const getBlocksInSelection = (): HTMLElement[] => {
    const el = editorRef.current;
    if (!el) return [];
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    const range = sel.getRangeAt(0);
    const startBlock = getBlockElement(range.startContainer);
    const endBlock = getBlockElement(range.endContainer);
    if (!startBlock || !endBlock) return startBlock ? [startBlock] : [];
    if (startBlock === endBlock) return [startBlock];

    const intersecting: HTMLElement[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        return BLOCK_TAGS.has((node as Element).tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    let node: Node | null = walker.nextNode();
    while (node) {
      if (range.intersectsNode(node)) intersecting.push(node as HTMLElement);
      node = walker.nextNode();
    }
    if (intersecting.length === 0) return [startBlock];
    // Keep only innermost blocks (so we don't apply to both a div and its child p)
    return intersecting.filter((b) => !intersecting.some((other) => other !== b && b.contains(other)));
  };

  const parseBlockStyle = (styleStr: string): Record<string, string> => {
    const out: Record<string, string> = {};
    styleStr.split(";").forEach((s) => {
      const idx = s.indexOf(":");
      if (idx === -1) return;
      const k = s.slice(0, idx).trim();
      const v = s.slice(idx + 1).trim();
      if (k && v) out[k] = v;
    });
    return out;
  };

  const stringifyStyle = (obj: Record<string, string>) =>
    Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join("; ");

  const applyLineSpacingToBlock = (lineHeight: number) => {
    editorRef.current?.focus();
    const blocks = getBlocksInSelection();
    if (blocks.length === 0) return;
    blocks.forEach((block) => {
      const style = parseBlockStyle(block.getAttribute("style") || "");
      style["line-height"] = String(lineHeight);
      block.setAttribute("style", stringifyStyle(style));
    });
    if (editorRef.current) setHtmlContent(styleBlockRef.current + editorRef.current.innerHTML);
  };

  const applyParagraphSpacingToBlock = (margin: string) => {
    editorRef.current?.focus();
    const blocks = getBlocksInSelection();
    if (blocks.length === 0) return;
    blocks.forEach((block) => {
      const style = parseBlockStyle(block.getAttribute("style") || "");
      style["margin"] = margin;
      block.setAttribute("style", stringifyStyle(style));
    });
    if (editorRef.current) setHtmlContent(styleBlockRef.current + editorRef.current.innerHTML);
  };

  const handleImportGoogleDocsZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Please select a .zip file (Google Docs → File → Download → Web Page).", variant: "destructive" });
      return;
    }
    try {
      const { html, suggestedName } = await importGoogleDocsZip(file);
      lastExternalHtmlRef.current = html;
      setHtmlContent(html);
      if (!template && suggestedName) setName(suggestedName);
      toast({ title: "Import complete", description: "Content and images have been loaded. You can edit and save as a template." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read ZIP.";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a template name.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const detectedPlaceholders = extractPlaceholders(htmlContent);
  const unrecognizedPlaceholders = detectedPlaceholders.filter((p) => !KNOWN_PLACEHOLDER_KEYS.has(p));
  const { styleBlock: leadingStyleBlock } = splitLeadingStyleBlock(htmlContent);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex h-[min(90vh,100dvh)] max-h-[min(90vh,100dvh)] min-h-0 min-w-0 max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>
            {template ? "Edit Template" : "New Contract Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-auto px-4 py-4 sm:px-6">
          {/* Name and Version */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Franchise Agreement"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-version">Version</Label>
              <Input
                id="template-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          {/* Help Alert */}
          <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Placeholders</strong> like <code className="bg-background px-1 rounded">{"{{firstName}}"}</code> are automatically replaced with franchisee data.
              <strong className="ml-2">Signature blocks</strong> use <code className="bg-background px-1 rounded">{"{{franchiseeSignature}}"}</code> and <code className="bg-background px-1 rounded">{"{{counterSignature}}"}</code> — these render as signature images.
              <strong className="ml-2">Conditional sections</strong> (like Paid Media) only appear when the franchisee selects that option.
            </AlertDescription>
          </Alert>

          {/* Google Docs import instructions */}
          <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Import from Google Docs:</strong> In Google Docs, go to <strong>File → Download → Web page (.zip)</strong>. Then use the &quot;Import from Google Docs&quot; button above to upload that ZIP. Formatting, tables, and images are preserved.
              <strong className="mt-2 block">Page breaks:</strong> The export does not include page breaks. Add them manually where you want a new PDF page using the &quot;Insert page break&quot; button above.
            </AlertDescription>
          </Alert>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
            {/* Placeholder Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Insert Placeholder
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[400px] overflow-y-auto w-[280px]">
                {ALL_PLACEHOLDER_GROUPS.map((group, idx) => (
                  <div key={group.label}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.placeholders.map((p) => (
                      <DropdownMenuItem
                        key={p.key}
                        onClick={() => insertPlaceholder(p.key)}
                        className="flex flex-col items-start"
                      >
                        <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">
                          {p.key}
                        </code>
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Conditional Sections */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FileCode className="h-3.5 w-3.5" />
                  Conditional Section
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => insertSection(
                    SECTION_MARKERS.PAID_MEDIA_START,
                    SECTION_MARKERS.PAID_MEDIA_END,
                    "Paid Media"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Paid Media Section</span>
                    <span className="text-xs text-muted-foreground">
                      Only shows when paid media is selected
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => insertSection(
                    SECTION_MARKERS.NEW_LOCATION_START,
                    SECTION_MARKERS.NEW_LOCATION_END,
                    "New Location"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">New Location Section</span>
                    <span className="text-xs text-muted-foreground">
                      Only shows for new location signups
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={insertPageBreak}
              title="Insert page break (PDF will start a new page here)"
            >
              Insert page break
            </Button>

            <span className="w-px h-6 bg-border" aria-hidden />
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("bold")} title="Bold">
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("italic")} title="Italic">
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("underline")} title="Underline">
              <Underline className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertUnorderedList")} title="Bullet list">
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertOrderedList")} title="Numbered list">
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyLeft")} title="Align left">
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyCenter")} title="Align center">
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyRight")} title="Align right">
              <AlignRight className="h-3.5 w-3.5" />
            </Button>

            <span className="w-px h-6 bg-border" aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onMouseDown={(e) => e.preventDefault()} title="Line spacing (applies to current paragraph)">
                  Line spacing
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyLineSpacingToBlock(1)}>Single</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyLineSpacingToBlock(1.15)}>1.15</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyLineSpacingToBlock(1.5)}>1.5</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyLineSpacingToBlock(2)}>Double</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onMouseDown={(e) => e.preventDefault()} title="Paragraph spacing (applies to current paragraph)">
                  Paragraph spacing
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyParagraphSpacingToBlock("0.4em 0")}>Compact</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyParagraphSpacingToBlock("0.6em 0")}>Normal</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => applyParagraphSpacingToBlock("1em 0")}>Relaxed</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              ref={importZipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              aria-hidden
              onChange={handleImportGoogleDocsZip}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => importZipInputRef.current?.click()}
              title="Import from Google Docs export (File → Download → Web Page (.zip))"
            >
              <Upload className="h-3.5 w-3.5" />
              Import from Google Docs
            </Button>

            <div className="flex-1" />

            {/* Preview Toggle */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs px-3 h-7">Edit</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-3 h-7 gap-1">
                  <Eye className="h-3 w-3" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 min-h-[350px]">
            {activeTab === "edit" ? (
              <div className="border rounded-lg h-[380px] overflow-auto bg-white">
                <div
                  ref={editorRef}
                  className="contract-content p-6 min-h-[340px] outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  style={{
                    fontFamily: "inherit",
                    fontSize: "14px",
                    lineHeight: "1.6",
                  }}
                  data-placeholder="Start typing or import from Google Docs (File → Download → Web Page)..."
                  onKeyDown={(e) => {
                    if (e.key !== "Tab") return;
                    const sel = window.getSelection();
                    const node = sel?.anchorNode;
                    if (!node || !editorRef.current?.contains(node)) return;
                    const inList = node.nodeType === Node.ELEMENT_NODE
                      ? (node as Element).closest("li, ul, ol")
                      : (node.parentElement?.closest("li, ul, ol"));
                    if (!inList) return;
                    e.preventDefault();
                    document.execCommand(e.shiftKey ? "outdent" : "indent", false);
                    if (editorRef.current) setHtmlContent(styleBlockRef.current + editorRef.current.innerHTML);
                  }}
                  onInput={() => {
                    if (editorRef.current) {
                      lastExternalHtmlRef.current = null;
                      setHtmlContent(styleBlockRef.current + editorRef.current.innerHTML);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="border rounded-lg h-[380px] overflow-auto bg-white overflow-x-hidden">
                <div
                  ref={previewRef}
                  className="contract-content p-6"
                  style={{
                    fontFamily: "inherit",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    maxWidth: "100%",
                    overflowX: "hidden",
                  }}
                  dangerouslySetInnerHTML={{ __html: constrainImagesInHtml(htmlContent) }}
                />
              </div>
            )}
          </div>

          {/* Detected Placeholders */}
          {detectedPlaceholders.length > 0 && (
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">
                Detected Placeholders ({detectedPlaceholders.length}):
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {detectedPlaceholders.map((p) => (
                  <code
                    key={p}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >
                    {p}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Unrecognized variables — not in system, will not be replaced */}
          {unrecognizedPlaceholders.length > 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Variables that won&apos;t be replaced</strong> — the following are not in the system and will appear as-is in generated contracts. Fix typos or remove them.
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unrecognizedPlaceholders.map((p) => (
                    <code key={p} className="text-xs bg-destructive/20 px-2 py-0.5 rounded">
                      {p}
                    </code>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </DialogContent>
      
      {/* Minimal CSS: layout + page-break only. No list/numbering overrides — content is raw HTML; any <style> in the doc (e.g. from import) controls lists/typography. */}
      <style>{`
        .contract-content[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
        .contract-content, .ql-editor {
          padding: 24px;
        }
        .contract-content br, .ql-editor br {
          display: block;
          content: "";
          margin-top: 0.25em;
        }
        .contract-content table, .ql-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .contract-content table td, .contract-content table th,
        .ql-editor table td, .ql-editor table th {
          border: 1px solid #ccc;
          padding: 8px 12px;
        }
        .contract-content table th, .ql-editor table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .contract-content hr, .ql-editor hr {
          border: none;
          border-top: 1px solid #ccc;
          margin: 1.5em 0;
        }
        .contract-content blockquote, .ql-editor blockquote {
          border-left: 4px solid #ccc;
          padding-left: 1em;
          margin: 1em 0;
          color: #666;
        }
        .contract-content .contract-img-wrap, .ql-editor .contract-img-wrap {
          display: block;
          margin: 0.5em 0 1em 0;
          padding: 0;
          overflow: hidden;
          position: relative;
          left: 0;
          right: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .contract-content img, .ql-editor img {
          display: block;
          max-width: 100%;
          width: auto;
          height: auto;
          margin: 0;
          padding: 0;
          position: relative;
          float: none;
          object-fit: contain;
          box-sizing: border-box;
          vertical-align: top;
        }
        .contract-content, .ql-editor { max-width: 100%; overflow-x: hidden; box-sizing: border-box; }
        .contract-content *, .ql-editor * { box-sizing: border-box; }
        .contract-content .ql-align-center, .ql-editor .ql-align-center { text-align: center; }
        .contract-content .ql-align-right, .ql-editor .ql-align-right { text-align: right; }
        .contract-content .ql-align-justify, .ql-editor .ql-align-justify { text-align: justify; }
        .contract-content .ql-align-left, .ql-editor .ql-align-left { text-align: left; }
        .contract-content .ql-size-small, .ql-editor .ql-size-small { font-size: 0.75em; }
        .contract-content .ql-size-large, .ql-editor .ql-size-large { font-size: 1.25em; }
        .contract-content .ql-size-huge, .ql-editor .ql-size-huge { font-size: 1.5em; }
        .contract-content .ql-font-serif, .ql-editor .ql-font-serif { font-family: Georgia, Times New Roman, serif; }
        .contract-content .ql-font-monospace, .ql-editor .ql-font-monospace { font-family: Monaco, Courier New, monospace; }
        .contract-content .pdf-page-break, .ql-editor .pdf-page-break {
          border: none;
          border-top: 1px dashed #ccc;
          margin: 1em 0;
          padding: 0.25em 0;
        }
        .contract-content .pdf-page-break-label, .ql-editor .pdf-page-break-label {
          font-size: 12px;
          color: #999;
        }
      `}</style>
      {/* When present (e.g. Google Docs import), doc's own <style> runs last so it controls lists, numbering, fonts, spacing. */}
      {leadingStyleBlock ? (
        <style dangerouslySetInnerHTML={{ __html: leadingStyleBlock }} />
      ) : null}
    </Dialog>
  );
}
