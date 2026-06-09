import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";
import { STATUS_LABELS } from "@/constants";

export interface Franchisee {
  id: string;
  name: string;
  email: string;
  brand_name: string | null;
  plan_name: string | null;
  status: string;
  join_date: string;
}

interface FranchiseeTableProps {
  franchisees: Franchisee[];
  isLoading?: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  /** Called when super admin confirms delete of one franchisee */
  onDelete?: (franchisee: Franchisee) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
  payment_completed: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  contract_signed: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20",
  awaiting_countersign: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20",
  completed: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  active: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  inactive: "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20",
  cancelled: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
};

/** Statuses where a contract has been generated and can be viewed. */
const STATUS_HAS_CONTRACT = new Set(["contract_signed", "awaiting_countersign", "completed", "active", "inactive"]);

export function FranchiseeTable({
  franchisees,
  isLoading = false,
  totalCount,
  page,
  pageSize,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onDelete,
}: FranchiseeTableProps) {
  const { role } = useUser();
  const isSuperAdmin = role === "super_admin";
  const [deleteTarget, setDeleteTarget] = useState<Franchisee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(totalCount / pageSize);
  const allSelected = franchisees.length > 0 && franchisees.every((f) => selectedIds.has(f.id));
  const someSelected = franchisees.some((f) => selectedIds.has(f.id));

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDelete) return;
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(deleteTarget));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const SortableHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon column={column} />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox disabled />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  aria-label="Select all"
                  className={someSelected && !allSelected ? "data-[state=checked]:bg-primary/50" : ""}
                />
              </TableHead>
              <SortableHeader column="name">Name</SortableHeader>
              <SortableHeader column="email">Email</SortableHeader>
              <TableHead>Brand</TableHead>
              <TableHead>Plan</TableHead>
              <SortableHeader column="status">Status</SortableHeader>
              <SortableHeader column="join_date">Join Date</SortableHeader>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {franchisees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <p className="text-muted-foreground">No franchisees found</p>
                </TableCell>
              </TableRow>
            ) : (
              franchisees.map((franchisee) => (
                <TableRow 
                  key={franchisee.id}
                  className={selectedIds.has(franchisee.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(franchisee.id)}
                      onCheckedChange={(checked) => onSelectOne(franchisee.id, !!checked)}
                      aria-label={`Select ${franchisee.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{franchisee.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {franchisee.email}
                  </TableCell>
                  <TableCell>{franchisee.brand_name || "—"}</TableCell>
                  <TableCell>{franchisee.plan_name || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[franchisee.status] || statusColors.pending}
                    >
                      {STATUS_LABELS[franchisee.status as keyof typeof STATUS_LABELS] || franchisee.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(franchisee.join_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="gap-1.5"
                      >
                        <Link to={`/admin/franchisees/${franchisee.id}`} aria-label={`View ${franchisee.name}`}>
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">View</span>
                        </Link>
                      </Button>
                      {STATUS_HAS_CONTRACT.has(franchisee.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="gap-1.5"
                        >
                          <Link
                            to={`/admin/franchisees/${franchisee.id}?view=contract#documents`}
                            aria-label={`View contract for ${franchisee.name}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">View the Contract</span>
                            <span className="md:hidden">Contract</span>
                          </Link>
                        </Button>
                      )}
                      {isSuperAdmin && onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(franchisee)}
                          aria-label={`Delete ${franchisee.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
          )}
        </TableBody>
        </Table>
      </div>

      {/* Delete confirmation modal (super admin only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete franchisee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>
                  {deleteTarget.email ? (
                    <> ({deleteTarget.email})</>
                  ) : null}
                  ? This will remove their account and cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, totalCount)} of {totalCount} franchisees
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => onPageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
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
