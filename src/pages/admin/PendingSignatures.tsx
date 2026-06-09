import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { ContractCounterSign } from "@/components/admin/ContractCounterSign";
import { FileText, PenLine, Clock, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function PendingSignatures() {
  const [counterSignOpen, setCounterSignOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [selectedFranchisee, setSelectedFranchisee] = useState<string>("");
  const [searchParams] = useSearchParams();

  const { data: pendingContracts, isLoading, error } = useQuery({
    queryKey: ["pending-countersign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(`
          id,
          franchisee_id,
          status,
          created_at,
          final_html,
          franchisee_signature,
          franchisee_signed_at,
          counter_signature,
          counter_signed_at,
          contract_templates!inner(name, version),
          franchisees!inner(id, name, email, brands(name))
        `)
        .eq("status", "signed_by_franchisee")
        .order("franchisee_signed_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Auto-open counter-sign modal when ?contract=<id> is in the URL
  useEffect(() => {
    const contractId = searchParams.get("contract");
    if (!contractId || !pendingContracts) return;
    const match = pendingContracts.find((c: any) => c.id === contractId);
    if (match) {
      setSelectedContract(match);
      setSelectedFranchisee(match.franchisees?.name || "Unknown");
      setCounterSignOpen(true);
    }
  }, [searchParams, pendingContracts]);

  const handleCounterSign = (contract: any) => {
    setSelectedContract(contract);
    setSelectedFranchisee(contract.franchisees?.name || "Unknown");
    setCounterSignOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex flex-wrap items-center gap-2 sm:gap-3">
            <PenLine className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            <span className="break-words">Pending Signatures</span>
          </h1>
          <p className="text-muted-foreground">
            Contracts awaiting your counter-signature
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Signature</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : pendingContracts?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                contracts need your attention
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Oldest Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : pendingContracts && pendingContracts.length > 0 && pendingContracts[0].franchisee_signed_at ? (
                  formatDistanceToNow(new Date(pendingContracts[0].franchisee_signed_at), { addSuffix: false })
                ) : (
                  "—"
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                waiting for signature
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Action Required</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-12" /> : pendingContracts?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Sign contracts to activate franchisees
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            Failed to load pending contracts: {(error as Error).message}
          </div>
        )}

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contracts Awaiting Counter-Signature</CardTitle>
            <CardDescription>
              Review and sign contracts that have been signed by franchisees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingContracts && pendingContracts.length > 0 ? (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Franchisee</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="hidden md:table-cell">Contract</TableHead>
                    <TableHead>Signed On</TableHead>
                    <TableHead className="hidden lg:table-cell">Waiting</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingContracts.map((contract: any) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.franchisees?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {contract.franchisees?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {contract.franchisees?.brands?.name || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{contract.contract_templates?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              v{contract.contract_templates?.version}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contract.franchisee_signed_at
                          ? format(new Date(contract.franchisee_signed_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge 
                          variant="outline" 
                          className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                        >
                          {contract.franchisee_signed_at
                            ? formatDistanceToNow(new Date(contract.franchisee_signed_at), { addSuffix: false })
                            : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleCounterSign(contract)}
                          className="w-full gap-1.5 sm:w-auto"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                          Counter-Sign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <PenLine className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  All caught up!
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  No contracts are awaiting your signature. Check back later or view all contracts in the Contracts section.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Counter-Sign Modal */}
      <ContractCounterSign
        open={counterSignOpen}
        onClose={() => {
          setCounterSignOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
        franchiseeName={selectedFranchisee}
      />
    </AdminLayout>
  );
}
