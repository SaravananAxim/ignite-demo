import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Briefcase, ChevronRight } from "lucide-react";

export default function CompletedSignups() {
  // Fetch completed contracts grouped by portal
  const { data: completedData, isLoading } = useQuery({
    queryKey: ["completed-signups-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select(`
          id,
          counter_signed_at,
          franchisees (
            id,
            brands (
              portal_id,
              portals (
                id,
                name
              )
            )
          )
        `)
        .eq("status", "fully_signed")
        .order("counter_signed_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Group by portal only
  const groupedData = completedData?.reduce((acc, contract) => {
    const portalId = contract.franchisees?.brands?.portal_id;
    const portalName = contract.franchisees?.brands?.portals?.name || "Unknown Portal";

    if (!portalId) return acc;

    if (!acc[portalId]) {
      acc[portalId] = {
        name: portalName,
        count: 0,
        latestSignup: null as string | null,
      };
    }

    acc[portalId].count++;

    // Track latest signup
    if (!acc[portalId].latestSignup || 
        (contract.counter_signed_at && contract.counter_signed_at > acc[portalId].latestSignup!)) {
      acc[portalId].latestSignup = contract.counter_signed_at;
    }

    return acc;
  }, {} as Record<string, { name: string; count: number; latestSignup: string | null }>);

  const totalCompleted = completedData?.length || 0;
  const totalPortals = Object.keys(groupedData || {}).length;

  return (
    <AdminLayout>
      <div className="space-y-6 px-1">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <span className="truncate">Completed Sign-ups</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            All franchisees with fully signed contracts, organized by portal
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (
                <div className="text-xl sm:text-2xl font-bold">{totalCompleted}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Portals</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (
                <div className="text-xl sm:text-2xl font-bold">{totalPortals}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Portal Cards */}
        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 sm:p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : Object.keys(groupedData || {}).length === 0 ? (
          <Card>
            <CardContent className="py-10 sm:py-12 text-center px-4">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/30" />
              <p className="text-sm sm:text-base text-muted-foreground">No completed sign-ups found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(groupedData || {}).map(([portalId, portal]) => (
              <Link
                key={portalId}
                to={`/admin/completed-signups/${portalId}`}
                className="group block"
              >
                <Card className="h-full transition-all hover:border-primary hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                          <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors truncate">
                            {portal.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {portal.count} {portal.count === 1 ? 'completed signup' : 'completed signups'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
