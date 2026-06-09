import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { usePortal } from "@/contexts/PortalContext";
import { FranchiseeLayout } from "@/components/layout/FranchiseeLayout";
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
import { ContractViewer } from "@/components/contract/ContractViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Building2, 
  FileText, 
  Plus, 
  Eye, 
  Download, 
  CheckCircle2, 
  Clock,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  active: "bg-green-500/10 text-green-600 border-green-500/30",
  inactive: "bg-slate-500/10 text-slate-600 border-slate-500/30",
};

const contractStatusColors: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600",
  sent: "bg-blue-500/10 text-blue-600",
  signed_by_franchisee: "bg-amber-500/10 text-amber-600",
  fully_signed: "bg-green-500/10 text-green-600",
};

const contractStatusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  signed_by_franchisee: "Awaiting Counter-Sign",
  fully_signed: "Fully Signed",
};

export default function FranchiseeDashboard() {
  const { user } = useUser();
  const { portal } = usePortal();
  const navigate = useNavigate();
  const [previewContract, setPreviewContract] = useState<any>(null);

  // Fetch all franchisee records for this user within the current portal
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["my-submissions", user?.id, portal?.portal_id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("franchisees")
        .select(`
          id,
          name,
          email,
          status,
          franchise_location_name,
          address,
          service_start_date,
          created_at,
          include_paid_media,
          brands!left(id, name, portal_id),
          plans!left(id, name, monthly_price)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // If we're in a portal context, filter to that portal's brands
      if (portal?.portal_id) {
        query = query.eq("brands.portal_id", portal.portal_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter out entries where brand doesn't match portal (due to left join behavior)
      if (portal?.portal_id) {
        return data?.filter(d => d.brands?.portal_id === portal.portal_id) || [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch contracts for all franchisee records
  const { data: contracts } = useQuery({
    queryKey: ["my-contracts", submissions?.map(s => s.id)],
    queryFn: async () => {
      if (!submissions?.length) return [];
      
      const franchiseeIds = submissions.map(s => s.id);
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(`
          id,
          franchisee_id,
          status,
          created_at,
          final_html,
          pdf_url,
          signed_pdf_url,
          franchisee_signature,
          counter_signature,
          franchisee_signed_at,
          counter_signed_at,
          contract_templates!inner(name, version)
        `)
        .in("franchisee_id", franchiseeIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!submissions?.length,
  });

  const getContractsForFranchisee = (franchiseeId: string) => {
    return contracts?.filter(c => c.franchisee_id === franchiseeId) || [];
  };

  const handleStartNew = () => {
    navigate("/select-brand");
  };

  const handleViewContract = (contract: any) => {
    setPreviewContract(contract);
  };

  const activeCount = submissions?.filter(s => s.status === "active").length || 0;
  const pendingCount = submissions?.filter(s => s.status === "pending").length || 0;

  return (
    <FranchiseeLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Locations</h1>
            <p className="text-muted-foreground">
              View and manage all your franchise registrations
            </p>
          </div>
          <Button onClick={handleStartNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Register New Location
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">Total Locations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : submissions?.length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeCount}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {isLoading ? <Skeleton className="h-8 w-12" /> : pendingCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-6">
            {submissions.map((submission: any) => {
              const submissionContracts = getContractsForFranchisee(submission.id);
              
              return (
                <Card key={submission.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <MapPin className="h-5 w-5 text-primary shrink-0" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {submission.franchise_location_name || submission.name}
                          </CardTitle>
                          <CardDescription>
                            {submission.brands?.name} • {submission.plans?.name}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColors[submission.status] || statusColors.pending}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Location Details */}
                    <div className="grid gap-4 sm:grid-cols-3 mb-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Address</p>
                        <p className="font-medium">{submission.address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registered</p>
                        <p className="font-medium">
                          {format(new Date(submission.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Service Start</p>
                        <p className="font-medium">
                          {submission.service_start_date
                            ? format(new Date(submission.service_start_date + "T00:00:00"), "MMM d, yyyy")
                            : "Pending"}
                        </p>
                      </div>
                    </div>

                    {/* Contracts */}
                    {submissionContracts.length > 0 && (
                      <div className="border-t pt-4 min-w-0">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Contracts
                        </h4>
                        <Table className="min-w-[480px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Document</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {submissionContracts.map((contract: any) => (
                              <TableRow key={contract.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span>{contract.contract_templates?.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={contractStatusColors[contract.status] || contractStatusColors.draft}
                                  >
                                    {contractStatusLabels[contract.status] || contract.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {format(new Date(contract.created_at), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewContract(contract)}
                                      className="gap-1"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      View
                                    </Button>
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-4">
                  <Building2 className="h-8 w-8 text-primary shrink-0" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No locations yet</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  You haven't registered any franchise locations. Start your first registration now!
                </p>
                <Button onClick={handleStartNew} className="gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  Register Your First Location
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Contract Preview Modal */}
      <Dialog open={!!previewContract} onOpenChange={() => setPreviewContract(null)}>
        <DialogContent className="flex h-[min(92dvh,100dvh)] max-h-[min(92dvh,100dvh)] min-h-0 min-w-0 max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle className="break-words text-base sm:text-lg">
              {previewContract?.contract_templates?.name} v{previewContract?.contract_templates?.version}
            </DialogTitle>
          </DialogHeader>
          {previewContract && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ContractViewer
                variant="modal"
                htmlContent={previewContract.final_html}
                franchiseeSignature={previewContract.franchisee_signature}
                counterSignature={previewContract.counter_signature}
                franchiseeSignedAt={previewContract.franchisee_signed_at}
                counterSignedAt={previewContract.counter_signed_at}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FranchiseeLayout>
  );
}
