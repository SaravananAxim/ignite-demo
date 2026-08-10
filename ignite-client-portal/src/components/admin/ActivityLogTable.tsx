import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ActivityLogRow, ACTION_LABELS } from "@/types/activityLog";

interface ActivityLogTableProps {
  targetType?: string;
  targetId?: string;
  showFilters?: boolean;
  pageSize?: number;
}

const actionColors: Record<string, string> = {
  created: "bg-green-500/10 text-green-600",
  updated: "bg-blue-500/10 text-blue-600",
  deleted: "bg-red-500/10 text-red-600",
  activated: "bg-green-500/10 text-green-600",
  deactivated: "bg-amber-500/10 text-amber-600",
  sent: "bg-purple-500/10 text-purple-600",
  signed: "bg-emerald-500/10 text-emerald-600",
  login: "bg-slate-500/10 text-slate-600",
  logout: "bg-slate-500/10 text-slate-600",
  changed: "bg-blue-500/10 text-blue-600",
  bulk: "bg-orange-500/10 text-orange-600",
  export: "bg-cyan-500/10 text-cyan-600",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(actionColors)) {
    if (action.includes(key)) return color;
  }
  return "bg-muted text-muted-foreground";
}

export function ActivityLogTable({
  targetType,
  targetId,
  showFilters = true,
  pageSize = 10,
}: ActivityLogTableProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", targetType, targetId, page, searchQuery, actionFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Filter by target if provided
      if (targetType) {
        query = query.eq("target_type", targetType);
      }
      if (targetId) {
        query = query.eq("target_id", targetId);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(`user_email.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%`);
      }

      // Apply action filter
      if (actionFilter !== "all") {
        query = query.ilike("action", `%${actionFilter}%`);
      }

      // Apply type filter
      if (typeFilter !== "all") {
        query = query.eq("target_type", typeFilter);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { logs: data as ActivityLogRow[], totalCount: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / pageSize);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or action..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="activated">Activated</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
              <SelectItem value="bulk">Bulk Actions</SelectItem>
            </SelectContent>
          </Select>
          {!targetType && (
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="franchisee">Franchisee</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              {!targetType && <TableHead>Target</TableHead>}
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.logs && data.logs.length > 0 ? (
              data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{log.user_email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  {!targetType && (
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {log.target_type}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="max-w-[300px]">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <span className="text-sm text-muted-foreground truncate block">
                        {JSON.stringify(log.details).slice(0, 50)}
                        {JSON.stringify(log.details).length > 50 && "..."}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={targetType ? 4 : 5} className="h-32 text-center">
                  <p className="text-muted-foreground">No activity logs found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, data?.totalCount || 0)} of{" "}
            {data?.totalCount} logs
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
