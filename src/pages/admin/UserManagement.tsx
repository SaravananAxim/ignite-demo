import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { Users, Plus, Pencil, Trash2, Shield, Loader2, Crown, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { activityLogger } from "@/lib/activityLogger";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";

const PAGE_SIZE = 50;

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_admin";
  created_at: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "super_admin">("admin");
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "admin" as "admin" | "super_admin",
  });

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: "created_at",
    defaultDirection: "desc",
  });

  // Server-sortable columns live on user_roles; email/full_name come from profiles (client-side sort)
  const serverSortCol = ["role", "created_at"].includes(sortColumn) ? sortColumn : "created_at";

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("role", ["admin", "super_admin"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { currentPage, totalPages, pageSize, offset, goToPage } = usePagination({
    totalCount,
    pageSize: PAGE_SIZE,
    resetKey: `${sortColumn}-${sortDirection}`,
  });

  const { data: adminUsers, isLoading } = useQuery({
    queryKey: ["admin-users", serverSortCol, sortDirection, currentPage],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("role", ["admin", "super_admin"])
        .order(serverSortCol, { ascending: sortDirection === "asc" })
        .range(offset, offset + PAGE_SIZE - 1);

      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [] as AdminUser[];

      const userIds = rolesData.map((r) => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

      return rolesData.map((roleItem) => {
        const profile = profilesMap.get(roleItem.user_id);
        return {
          id: roleItem.user_id,
          email: profile?.email || "",
          full_name: profile?.full_name || null,
          role: roleItem.role as "admin" | "super_admin",
          created_at: roleItem.created_at,
        };
      }) as AdminUser[];
    },
  });

  // Client-side sort for email / full_name (affects the current page only)
  const sortedUsers = useMemo(() => {
    if (!adminUsers) return [];
    if (["role", "created_at"].includes(sortColumn)) return adminUsers; // already server-sorted
    return [...adminUsers].sort((a, b) => {
      const aVal = (sortColumn === "email" ? a.email : a.full_name ?? "") || "";
      const bVal = (sortColumn === "email" ? b.email : b.full_name ?? "") || "";
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [adminUsers, sortColumn, sortDirection]);

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "super_admin" }) => {
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
          data: { invited_by: currentUser?.id, role },
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", authData.user.id);
      if (roleError) throw roleError;
      return authData.user;
    },
    onSuccess: async (user) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-count"] });
      goToPage(1);
      if (user) {
        await activityLogger.logActivity("user_invited", "user", user.id, { email: user.email, role: inviteRole });
      }
      toast({ title: "Invitation sent", description: "User has been invited. They can sign in at the admin login with their email and a verification code." });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("admin");
    },
    onError: (error: any) => {
      if (error.message?.includes("already registered")) {
        toast({ title: "User exists", description: "This email is already registered. You can edit their role from the list.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "super_admin" }) => {
      const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);
      if (error) throw error;
      return { userId, role };
    },
    onSuccess: async ({ userId, role }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await activityLogger.userRoleChanged(userId, { new_role: role, email: selectedUser?.email });
      toast({ title: "Role updated", description: "User role has been updated successfully." });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeAccessMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").update({ role: "franchisee" }).eq("user_id", userId);
      if (error) throw error;
      return userId;
    },
    onSuccess: async (userId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-count"] });
      goToPage(1);
      await activityLogger.logActivity("user_access_revoked", "user", userId, { email: selectedUser?.email });
      toast({ title: "Access removed", description: "User has been removed from admin access." });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({ email: user.email, full_name: user.full_name || "", role: user.role });
    setEditDialogOpen(true);
  };

  const handleDelete = (user: AdminUser) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: formData.role });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedUser) removeAccessMutation.mutate(selectedUser.id);
  };

  const handleInvite = () => {
    if (!inviteEmail) {
      toast({ title: "Email required", description: "Please enter an email address.", variant: "destructive" });
      return;
    }
    inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const getRoleBadge = (role: "admin" | "super_admin") => {
    if (role === "super_admin") {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
          <Crown className="h-3 w-3" /> Super Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary gap-1">
        <Shield className="h-3 w-3" /> Admin
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Invite and manage admin users (invite-only access)</p>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Invite Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin & Super Admin Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : sortedUsers.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("email")}>
                          <div className="flex items-center gap-1">Email <SortIcon column="email" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("full_name")}>
                          <div className="flex items-center gap-1">Full Name <SortIcon column="full_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("role")}>
                          <div className="flex items-center gap-1">Role <SortIcon column="role" /></div>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("created_at")}>
                          <div className="flex items-center gap-1">Added <SortIcon column="created_at" /></div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium truncate">{user.full_name || "—"}</p>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">
                            {format(new Date(user.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(user)} className="gap-1.5" disabled={user.id === currentUser?.id}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(user)} className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={user.id === currentUser?.id}>
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={goToPage}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No admin users found</p>
                <p className="text-sm text-muted-foreground mt-1">Invite users to grant them admin access</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-blue-500/10 p-2 shrink-0">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">Invite-Only Admin Access</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Admin portal access is invite-only. Super admins can invite new admins and manage their roles.
                  <strong className="text-foreground"> Admins</strong> can view all data and manage portals/brands/plans.
                  <strong className="text-foreground"> Super Admins</strong> can additionally counter-sign contracts and manage users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Invite Admin User</DialogTitle>
            <DialogDescription>Send an invitation to grant admin access. The user will receive an email to set up their account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input id="invite-email" type="email" placeholder="admin@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "admin" | "super_admin")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="h-4 w-4" />Admin - View & manage data</div></SelectItem>
                  <SelectItem value="super_admin"><div className="flex items-center gap-2"><Crown className="h-4 w-4" />Super Admin - Full access + counter-sign</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviteUserMutation.isPending || !inviteEmail}>
              {inviteUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User Role</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value as "admin" | "super_admin" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove admin access from {selectedUser?.email}? They will lose access to the admin portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeAccessMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={removeAccessMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removeAccessMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
