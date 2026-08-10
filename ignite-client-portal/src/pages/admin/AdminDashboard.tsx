import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { FranchiseeTable, Franchisee } from "@/components/admin/FranchiseeTable";
import { FranchiseeFilters } from "@/components/admin/FranchiseeFilters";
import { BulkActionsMenu } from "@/components/admin/BulkActionsMenu";
import { PendingSignaturesWidget } from "@/components/admin/PendingSignaturesWidget";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { activityLogger } from "@/lib/activityLogger";
import Papa from "papaparse";

const PAGE_SIZE = 10;

export default function AdminDashboard() {
  const { toast } = useToast();
  const { role } = useUser();
  const queryClient = useQueryClient();
  const isSuperAdmin = role === "super_admin";

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Pagination state
  const [page, setPage] = useState(1);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState("join_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch brands for filter dropdown
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch plans for filter dropdown
  const { data: plans = [] } = useQuery({
    queryKey: ["plans-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch franchisees with filters
  const { data: franchiseesData, isLoading: isLoadingFranchisees } = useQuery({
    queryKey: [
      "franchisees",
      debouncedSearch,
      brandFilter,
      planFilter,
      statusFilter,
      page,
      sortColumn,
      sortDirection,
    ],
    queryFn: async () => {
      let query = supabase
        .from("franchisees")
        .select(
          `
          id,
          name,
          email,
          status,
          join_date,
          brands!left(name),
          plans!left(name)
        `,
          { count: "exact" }
        );

      // Apply search filter
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`
        );
      }

      // Apply brand filter
      if (brandFilter !== "all") {
        query = query.eq("brand_id", brandFilter);
      }

      // Apply plan filter
      if (planFilter !== "all") {
        query = query.eq("plan_id", planFilter);
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply sorting
      query = query.order(sortColumn, { ascending: sortDirection === "asc" });

      // Apply pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Transform data to match Franchisee interface
      const franchisees: Franchisee[] = (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        email: f.email,
        brand_name: f.brands?.name || null,
        plan_name: f.plans?.name || null,
        status: f.status as "active" | "pending" | "inactive",
        join_date: f.join_date,
      }));

      return { franchisees, totalCount: count || 0 };
    },
  });

  // Fetch stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [franchiseesResult, activeContractsResult, pendingResult] =
        await Promise.all([
          supabase
            .from("franchisees")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("generated_contracts")
            .select("id", { count: "exact", head: true })
            .eq("status", "signed"),
          supabase
            .from("franchisees")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        ]);

      return {
        totalFranchisees: franchiseesResult.count || 0,
        activeContracts: activeContractsResult.count || 0,
        pendingApprovals: pendingResult.count || 0,
      };
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("franchisees")
        .update({ status })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setSelectedIds(new Set());
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("franchisees")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setSelectedIds(new Set());
    },
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleBrandFilterChange = (value: string) => {
    setBrandFilter(value);
    setPage(1);
  };

  const handlePlanFilterChange = (value: string) => {
    setPlanFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked && franchiseesData?.franchisees) {
      setSelectedIds(new Set(franchiseesData.franchisees.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk action handlers
  const handleBulkActivate = async () => {
    setIsBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await bulkUpdateMutation.mutateAsync({
        ids,
        status: "active",
      });
      await activityLogger.bulkActivate(ids.length, ids);
      toast({
        title: "Franchisees activated",
        description: `${selectedIds.size} franchisee(s) have been activated.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setIsBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await bulkUpdateMutation.mutateAsync({
        ids,
        status: "inactive",
      });
      await activityLogger.bulkDeactivate(ids.length, ids);
      toast({
        title: "Franchisees deactivated",
        description: `${selectedIds.size} franchisee(s) have been deactivated.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await bulkDeleteMutation.mutateAsync(ids);
      await activityLogger.bulkDelete(ids.length, ids);
      toast({
        title: "Franchisees deleted",
        description: `${selectedIds.size} franchisee(s) have been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleDeleteOne = async (franchisee: Franchisee) => {
    await bulkDeleteMutation.mutateAsync([franchisee.id]);
    await activityLogger.bulkDelete(1, [franchisee.id]);
    toast({
      title: "Franchisee deleted",
      description: `${franchisee.name} has been removed.`,
    });
  };

  const handleExportCsv = async () => {
    const selectedFranchisees = franchiseesData?.franchisees.filter((f) =>
      selectedIds.has(f.id)
    );

    if (!selectedFranchisees || selectedFranchisees.length === 0) {
      toast({
        title: "No data to export",
        description: "Please select at least one franchisee.",
        variant: "destructive",
      });
      return;
    }

    const csvData = selectedFranchisees.map((f) => ({
      Name: f.name,
      Email: f.email,
      Brand: f.brand_name || "",
      Plan: f.plan_name || "",
      Status: f.status,
      "Join Date": f.join_date,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `franchisees-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await activityLogger.bulkExport(selectedFranchisees.length, "csv");

    toast({
      title: "Export successful",
      description: `${selectedFranchisees.length} franchisee(s) exported to CSV.`,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Franchisee Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage and monitor all franchisees in your system
          </p>
        </div>

        {/* Stats - responsive grid */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardStats
              totalFranchisees={stats?.totalFranchisees || 0}
              activeContracts={stats?.activeContracts || 0}
              pendingApprovals={stats?.pendingApprovals || 0}
              isLoading={isLoadingStats}
            />
          </div>
          <PendingSignaturesWidget />
        </div>

        {/* Filters & Bulk Actions - stack on mobile */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:w-auto">
            <FranchiseeFilters
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              brandFilter={brandFilter}
              onBrandFilterChange={handleBrandFilterChange}
              planFilter={planFilter}
              onPlanFilterChange={handlePlanFilterChange}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              brands={brands}
              plans={plans}
            />
          </div>
          <div className="w-full lg:w-auto">
            <BulkActionsMenu
              selectedCount={selectedIds.size}
              onActivate={handleBulkActivate}
              onDeactivate={handleBulkDeactivate}
              onDelete={handleBulkDelete}
              onExportCsv={handleExportCsv}
              isLoading={isBulkLoading}
            />
          </div>
        </div>

        {/* Table - with horizontal scroll on mobile */}
        <div className="overflow-x-auto">
          <FranchiseeTable
            franchisees={franchiseesData?.franchisees || []}
            isLoading={isLoadingFranchisees}
            totalCount={franchiseesData?.totalCount || 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onDelete={isSuperAdmin ? handleDeleteOne : undefined}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
