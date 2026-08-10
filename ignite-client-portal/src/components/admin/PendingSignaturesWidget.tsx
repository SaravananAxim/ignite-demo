import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { PenLine, ArrowRight, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function PendingSignaturesWidget() {
  const { role } = useUser();
  const isSuperAdmin = role === "super_admin";

  const { data: pendingContracts, isLoading } = useQuery({
    queryKey: ["pending-countersign-preview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(`
          id,
          franchisee_signed_at,
          franchisees!inner(name),
          contract_templates!inner(name)
        `)
        .eq("status", "signed_by_franchisee")
        .order("franchisee_signed_at", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const pendingCount = pendingContracts?.length || 0;

  return (
    <Card className={pendingCount > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base font-semibold">Pending Signatures</CardTitle>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {pendingCount} awaiting
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pendingCount > 0 ? (
          <>
            <div className="space-y-3">
              {pendingContracts?.slice(0, 3).map((contract: any) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                      <FileText className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{contract.franchisees?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {contract.contract_templates?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {contract.franchisee_signed_at
                      ? formatDistanceToNow(new Date(contract.franchisee_signed_at), { addSuffix: true })
                      : "—"}
                  </div>
                </div>
              ))}
            </div>

            {isSuperAdmin && (
              <Button asChild variant="outline" className="w-full mt-4 gap-2">
                <Link to="/admin/pending-signatures">
                  View All & Sign
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}

            {!isSuperAdmin && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Only Super Admins can counter-sign contracts
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <PenLine className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              No contracts awaiting signature
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
