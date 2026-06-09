import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle2, Building2, Eye, Download, ChevronRight,
  FileText, Briefcase, Trash2,
} from "lucide-react";
import { useState } from "react";
import { ContractPreview } from "@/components/admin/ContractPreview";
import { generateContractPDF, insertSignatureImages } from "@/lib/pdfGenerator";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";

const PAGE_SIZE = 50;

export default function PortalCompletedSignups() {
  const { portalId } = useParams<{ portalId: string }>();
  const queryClient = useQueryClient();
  const { role } = useUser();
  const isSuperAdmin = role === "super_admin";
  const [previewContract, setPreviewContract] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: "counter_signed_at",
    defaultDirection: "desc",
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["portal-completed-signups-count", portalId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_contracts")
        .select("*, franchisees!inner(brands!inner(portal_id))", { count: "exact", head: true })
        .eq("status", "fully_signed")
        .eq("franchisees.brands.portal_id", portalId as string);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!portalId,
  });

  const { currentPage, totalPages, pageSize, offset, goToPage } = usePagination({
    totalCount,
    pageSize: PAGE_SIZE,
    resetKey: `${sortColumn}-${sortDirection}`,
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.from("generated_contracts").delete().eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-completed-signups", portalId] });
      queryClient.invalidateQueries({ queryKey: ["portal-completed-signups-count", portalId] });
      goToPage(1);
      setDeleteTarget(null);
      toast({ title: "Contract removed", description: "The completed sign-up has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: portal } = useQuery({
    queryKey: ["portal", portalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("portals").select("id, name").eq("id", portalId as string).single();
      if (error) throw error;
      return data;
    },
    enabled: !!portalId,
  });

  // Server-sortable columns on generated_contracts; others (franchisee name, brand, plan) sorted client-side
  const serverSortCol = ["counter_signed_at", "created_at", "status"].includes(sortColumn)
    ? sortColumn
    : "counter_signed_at";

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["portal-completed-signups", portalId, serverSortCol, sortDirection, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(`
          id,
          status,
          counter_signed_at,
          franchisee_signed_at,
          created_at,
          final_html,
          franchisee_signature,
          counter_signature,
          franchisees!inner (
            id,
            name,
            email,
            phone,
            franchise_location_name,
            brand_id,
            brands!inner (
              id,
              name,
              portal_id
            ),
            plans (
              id,
              name
            )
          ),
          contract_templates (
            id,
            name
          )
        `)
        .eq("status", "fully_signed")
        .eq("franchisees.brands.portal_id", portalId as string)
        .order(serverSortCol, { ascending: sortDirection === "asc" })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    },
    enabled: !!portalId,
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteContractMutation.mutateAsync(deleteTarget.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadPdf = async (contract: any) => {
    setIsDownloading(contract.id);
    try {
      const processedHtml = insertSignatureImages(
        contract.final_html,
        contract.franchisee_signature,
        contract.counter_signature,
        contract.franchisee_signed_at ? format(new Date(contract.franchisee_signed_at), "MMMM d, yyyy") : null,
        contract.counter_signed_at ? format(new Date(contract.counter_signed_at), "MMMM d, yyyy") : null,
      );
      const fileName = `${contract.contract_templates?.name || "Contract"}-${contract.franchisees?.name}.pdf`;
      const pdfBlob = await generateContractPDF(processedHtml, fileName);
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success("PDF opened in new tab");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(null);
    }
  };

  const uniqueBrands = new Set(contracts?.map((c) => (c.franchisees as any)?.brand_id)).size;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 px-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="self-start flex-shrink-0">
            <Link to="/admin/completed-signups"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
              <Link to="/admin/completed-signups" className="hover:text-foreground truncate">Completed Sign-ups</Link>
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="text-foreground truncate">{portal?.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">{portal?.name || <Skeleton className="h-7 w-32 sm:w-48" />}</span>
            </h1>
          </div>
          <Badge variant="secondary" className="text-sm sm:text-lg px-3 sm:px-4 py-1 self-start sm:self-auto flex-shrink-0">
            {totalCount} completed
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">Total Contracts</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              {isLoading ? <Skeleton className="h-6 sm:h-8 w-10 sm:w-16" /> : (
                <div className="text-lg sm:text-2xl font-bold">{totalCount}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">Latest Signup</CardTitle>
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              {isLoading ? <Skeleton className="h-6 sm:h-8 w-16 sm:w-32" /> : (
                <div className="text-sm sm:text-lg font-medium truncate">
                  {contracts?.[0]?.counter_signed_at
                    ? format(new Date(contracts[0].counter_signed_at), "MMM d, yyyy")
                    : "—"}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">Brands</CardTitle>
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              {isLoading ? <Skeleton className="h-6 sm:h-8 w-10 sm:w-16" /> : (
                <div className="text-lg sm:text-2xl font-bold">{uniqueBrands}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contracts Table */}
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Completed Contracts</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="space-y-3 p-4 sm:p-0">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 sm:h-16 w-full" />)}
              </div>
            ) : contracts?.length === 0 ? (
              <div className="text-center py-10 sm:py-12 px-4 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-30" />
                <p className="text-sm sm:text-base">No completed contracts for this portal</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="border-t sm:border sm:rounded-md min-w-[640px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="text-xs sm:text-sm cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => toggleSort("franchisee_name")}
                          >
                            <div className="flex items-center gap-1">Franchisee <SortIcon column="franchisee_name" /></div>
                          </TableHead>
                          <TableHead
                            className="text-xs sm:text-sm cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => toggleSort("brand_name")}
                          >
                            <div className="flex items-center gap-1">Brand <SortIcon column="brand_name" /></div>
                          </TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Location</TableHead>
                          <TableHead
                            className="text-xs sm:text-sm hidden lg:table-cell cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => toggleSort("plan_name")}
                          >
                            <div className="flex items-center gap-1">Plan <SortIcon column="plan_name" /></div>
                          </TableHead>
                          <TableHead
                            className="text-xs sm:text-sm cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => toggleSort("counter_signed_at")}
                          >
                            <div className="flex items-center gap-1">Signed At <SortIcon column="counter_signed_at" /></div>
                          </TableHead>
                          <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts?.map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell className="py-3">
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate max-w-[120px] sm:max-w-none">
                                  {(contract.franchisees as any)?.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                                  {(contract.franchisees as any)?.email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs truncate max-w-[80px] sm:max-w-none">
                                {(contract.franchisees as any)?.brands?.name || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm truncate block max-w-[120px]">
                                {(contract.franchisees as any)?.franchise_location_name || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="secondary" className="text-xs">
                                {(contract.franchisees as any)?.plans?.name || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs sm:text-sm">
                                {contract.counter_signed_at ? format(new Date(contract.counter_signed_at), "MMM d, yyyy") : "—"}
                              </div>
                              <div className="text-xs text-muted-foreground hidden sm:block">
                                {contract.counter_signed_at ? format(new Date(contract.counter_signed_at), "h:mm a") : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 sm:gap-2">
                                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3" onClick={() => setPreviewContract(contract)}>
                                  <Eye className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3" onClick={() => handleDownloadPdf(contract)} disabled={isDownloading === contract.id}>
                                  <Download className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">PDF</span>
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 hidden sm:flex" asChild>
                                  <Link to={`/admin/franchisees/${(contract.franchisees as any)?.id}`}>
                                    Details <ChevronRight className="h-4 w-4 ml-1" />
                                  </Link>
                                </Button>
                                {isSuperAdmin && (
                                  <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(contract)}>
                                    <Trash2 className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Delete</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={goToPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this completed sign-up?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  Are you sure you want to remove the contract for <strong>{(deleteTarget.franchisees as any)?.name}</strong>
                  {(deleteTarget.franchisees as any)?.email ? <> ({(deleteTarget.franchisees as any).email})</> : null}
                  ? This will delete the contract record and cannot be undone. The franchisee account will not be removed.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewContract && (
        <ContractPreview
          open={!!previewContract}
          onClose={() => setPreviewContract(null)}
          htmlContent={previewContract.final_html}
          templateName={previewContract.contract_templates?.name || "Contract"}
          franchiseeName={(previewContract.franchisees as any)?.name}
          franchiseeSignature={previewContract.franchisee_signature}
          counterSignature={previewContract.counter_signature}
          franchiseeSignedAt={previewContract.franchisee_signed_at}
          counterSignedAt={previewContract.counter_signed_at}
        />
      )}
    </AdminLayout>
  );
}
