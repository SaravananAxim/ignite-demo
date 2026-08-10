import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Eye, PenLine } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ContractPreview } from "./ContractPreview";
import { ContractCounterSign } from "./ContractCounterSign";
import { useUser } from "@/contexts/UserContext";

interface FranchiseeDocumentsProps {
  franchiseeId: string;
  franchiseeName: string;
  /** When true, auto-open counter-sign modal for first contract awaiting counter-sign (super_admin only). */
  openCounterSignIfAwaiting?: boolean;
  /** Called after we've consumed the "view contract" intent (e.g. opened counter-sign). */
  onConsumedViewContract?: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600",
  sent: "bg-blue-500/10 text-blue-600",
  signed_by_franchisee: "bg-amber-500/10 text-amber-600",
  fully_signed: "bg-green-500/10 text-green-600",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  signed_by_franchisee: "Awaiting Counter-Sign",
  fully_signed: "Fully Signed",
};

export function FranchiseeDocuments({
  franchiseeId,
  franchiseeName,
  openCounterSignIfAwaiting = false,
  onConsumedViewContract,
}: FranchiseeDocumentsProps) {
  const { role } = useUser();
  const isSuperAdmin = role === "super_admin";
  const consumedRef = useRef(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState<any>(null);
  const [counterSignOpen, setCounterSignOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // Fetch contracts for this franchisee
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["franchisee-contracts", franchiseeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(
          `
          id,
          franchisee_id,
          status,
          created_at,
          final_html,
          pdf_url,
          signed_pdf_url,
          franchisee_signature,
          franchisee_signed_at,
          counter_signature,
          counter_signed_at,
          contract_templates!inner(name, version)
        `
        )
        .eq("franchisee_id", franchiseeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleViewContract = (contract: any) => {
    setPreviewContract(contract);
    setPreviewOpen(true);
  };

  // Fast-track: when opened with ?view=contract, open the right modal by role and contract status
  useEffect(() => {
    if (consumedRef.current || !openCounterSignIfAwaiting || isLoading || !contracts?.length) return;
    const awaiting = contracts.find((c: any) => c.status === "signed_by_franchisee");
    if (awaiting && isSuperAdmin) {
      consumedRef.current = true;
      setSelectedContract(awaiting);
      setCounterSignOpen(true);
      onConsumedViewContract?.();
    } else {
      // Open first contract in preview so they can view it (any role, or no counter-sign needed)
      consumedRef.current = true;
      setPreviewContract(contracts[0]);
      setPreviewOpen(true);
      onConsumedViewContract?.();
    }
  }, [openCounterSignIfAwaiting, isSuperAdmin, isLoading, contracts, onConsumedViewContract]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contracts && contracts.length > 0 ? (
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract: any) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {contract.contract_templates?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            v{contract.contract_templates?.version}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[contract.status] || statusColors.draft}
                      >
                        {statusLabels[contract.status] || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(contract.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewContract(contract)}
                          className="gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        {/* Counter-sign button for awaiting contracts - super_admin only */}
                        {contract.status === "signed_by_franchisee" && isSuperAdmin && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setCounterSignOpen(true);
                            }}
                            className="gap-1"
                          >
                            <PenLine className="h-3.5 w-3.5" />
                            Counter-Sign
                          </Button>
                        )}
                        {/* Show status for non-super_admin on pending contracts */}
                        {contract.status === "signed_by_franchisee" && !isSuperAdmin && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                            Awaiting Counter-Sign
                          </Badge>
                        )}
                        {/* View signatures for fully signed */}
                        {contract.status === "fully_signed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setCounterSignOpen(true);
                            }}
                            className="gap-1"
                          >
                            <PenLine className="h-3.5 w-3.5" />
                            View Signatures
                          </Button>
                        )}
                        {(contract.pdf_url || contract.signed_pdf_url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="gap-1"
                          >
                            <a
                              href={contract.signed_pdf_url || contract.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No documents yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Preview Modal */}
      <ContractPreview
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewContract(null);
        }}
        htmlContent={previewContract?.final_html || ""}
        templateName={previewContract?.contract_templates?.name || "Contract"}
        franchiseeName={franchiseeName}
        franchiseeSignature={previewContract?.franchisee_signature}
        counterSignature={previewContract?.counter_signature}
        franchiseeSignedAt={previewContract?.franchisee_signed_at}
        counterSignedAt={previewContract?.counter_signed_at}
      />

      {/* Counter-Sign Modal */}
      <ContractCounterSign
        open={counterSignOpen}
        onClose={() => {
          setCounterSignOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
        franchiseeName={franchiseeName}
      />
    </>
  );
}
