import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FranchiseeDetailsCard,
  FranchiseeData,
} from "@/components/admin/FranchiseeDetailsCard";
import { FranchiseeDocuments } from "@/components/admin/FranchiseeDocuments";
import { FranchiseeActivityLog } from "@/components/admin/FranchiseeActivityLog";
import { activityLogger } from "@/lib/activityLogger";

export default function FranchiseeDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const viewContract = searchParams.get("view") === "contract";

  // Fetch franchisee data
  const {
    data: franchisee,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["franchisee", id],
    queryFn: async () => {
      if (!id) throw new Error("Franchisee ID is required");

      const { data, error } = await supabase
        .from("franchisees")
        .select(
          `
          id,
          name,
          email,
          phone,
          address,
          brand_id,
          plan_id,
          status,
          join_date,
          brands!left(name),
          plans!left(name)
        `
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Franchisee not found");

      return data as FranchiseeData;
    },
    enabled: !!id,
  });

  // Fetch brands for dropdown
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch plans for dropdown
  const { data: plans = [] } = useQuery({
    queryKey: ["plans-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<FranchiseeData>) => {
      if (!id) throw new Error("Franchisee ID is required");

      const { error } = await supabase
        .from("franchisees")
        .update(data)
        .eq("id", id);

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["franchisee", id] });
      if (id) {
        await activityLogger.franchiseeUpdated(id, { changes: Object.keys(data || {}) });
      }
      toast({
        title: "Changes saved",
        description: "Franchisee information has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!id || !franchisee) throw new Error("Franchisee data is required");

      const newStatus = franchisee.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("franchisees")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: async (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["franchisee", id] });
      if (id) {
        if (newStatus === "active") {
          await activityLogger.franchiseeActivated(id, { name: franchisee?.name });
        } else {
          await activityLogger.franchiseeDeactivated(id, { name: franchisee?.name });
        }
      }
      toast({
        title: `Franchisee ${newStatus === "active" ? "activated" : "deactivated"}`,
        description: `Status has been updated to ${newStatus}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = async (data: Partial<FranchiseeData>) => {
    await updateMutation.mutateAsync(data);
  };

  const handleToggleStatus = async () => {
    await toggleStatusMutation.mutateAsync();
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-[400px] w-full" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !franchisee) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Franchisee Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message || "The requested franchisee could not be found."}
          </p>
          <Button asChild>
            <Link to="/admin/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {franchisee.name}
            </h1>
            <p className="text-muted-foreground">{franchisee.email}</p>
          </div>
        </div>

        {/* Details Card */}
        <FranchiseeDetailsCard
          franchisee={franchisee}
          brands={brands}
          plans={plans}
          onSave={handleSave}
          onToggleStatus={handleToggleStatus}
          isSaving={updateMutation.isPending}
          isTogglingStatus={toggleStatusMutation.isPending}
        />

        {/* Documents & Activity */}
        <div id="documents" className="grid gap-6 lg:grid-cols-2 scroll-mt-6">
          <FranchiseeDocuments
            franchiseeId={franchisee.id}
            franchiseeName={franchisee.name}
            openCounterSignIfAwaiting={viewContract}
            onConsumedViewContract={() => {
              if (viewContract) {
                setSearchParams((p) => {
                  const next = new URLSearchParams(p);
                  next.delete("view");
                  return next;
                }, { replace: true });
              }
            }}
          />
          <FranchiseeActivityLog franchiseeId={franchisee.id} />
        </div>
      </div>
    </AdminLayout>
  );
}
