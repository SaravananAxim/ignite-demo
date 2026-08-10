import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trophy, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { PackagePicker } from '@/components/ui/package-picker';
import { activityLogger } from '@/lib/activityLogger';
import { usePagination } from '@/hooks/usePagination';
import { useSort } from '@/hooks/useSort';

const PAGE_SIZE = 50;
const TIERS = ['Foundation', 'Growth', 'Dominance'] as const;
const STATUSES = ['Active', 'Draft', 'Inactive'] as const;
const ROLES = ['visibility', 'credibility', 'convertibility', 'profitability'] as const;
type PillarRole = (typeof ROLES)[number];

interface ProgramRow {
  id: string;
  program_id: string;
  name: string;
  tier: string | null;
  monthly_price: number | null;
  one_time_price: number | null;
  visibility_component: string | null;
  credibility_component: string | null;
  convertibility_component: string | null;
  profitability_component: string | null;
  optional_accelerators: string[] | null;
  client_fit: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  program_packages?: { package_id: string }[];
}

interface ProgramFormData {
  program_id: string;
  name: string;
  tier: string;
  monthly_price: string;
  one_time_price: string;
  status: string;
  client_fit: string;
  optional_accelerators: string;
  visibilityPackageIds: string[];
  credibilityPackageIds: string[];
  convertibilityPackageIds: string[];
  profitabilityPackageIds: string[];
}

const EMPTY_FORM: ProgramFormData = {
  program_id: '',
  name: '',
  tier: '',
  monthly_price: '',
  one_time_price: '',
  status: 'Active',
  client_fit: '',
  optional_accelerators: '',
  visibilityPackageIds: [],
  credibilityPackageIds: [],
  convertibilityPackageIds: [],
  profitabilityPackageIds: [],
};

const ROLE_KEY: Record<PillarRole, keyof ProgramFormData> = {
  visibility: 'visibilityPackageIds',
  credibility: 'credibilityPackageIds',
  convertibility: 'convertibilityPackageIds',
  profitability: 'profitabilityPackageIds',
};

const ROLE_LABEL: Record<PillarRole, string> = {
  visibility: 'Visibility Component',
  credibility: 'Credibility Component',
  convertibility: 'Convertibility Component',
  profitability: 'Profitability Component',
};

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

function tierBadge(tier: string | null) {
  if (!tier) return <span className="text-sm text-muted-foreground">—</span>;
  if (tier === 'Dominance')
    return (
      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Dominance</Badge>
    );
  if (tier === 'Growth')
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Growth</Badge>;
  return <Badge variant="secondary">Foundation</Badge>;
}

function statusBadge(status: string) {
  if (status === 'Active')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  if (status === 'Draft') return <Badge variant="outline">Draft</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

export default function Programs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramRow | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(EMPTY_FORM);

  const queryClient = useQueryClient();

  const SERVER_SORT_COLS = new Set(['program_id', 'name', 'tier', 'monthly_price', 'status', 'created_at']);

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: 'monthly_price',
    defaultDirection: 'asc',
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['programs-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { currentPage, totalPages, pageSize, offset, goToPage } = usePagination({
    totalCount,
    pageSize: PAGE_SIZE,
    resetKey: `${sortColumn}-${sortDirection}`,
  });

  const { data: programsPage, isLoading } = useQuery({
    queryKey: ['programs', sortColumn, sortDirection, currentPage],
    queryFn: async () => {
      const effectiveCol = SERVER_SORT_COLS.has(sortColumn) ? sortColumn : 'monthly_price';
      const { data, error } = await supabase
        .from('programs')
        .select('*, program_packages(package_id)')
        .order(effectiveCol, { ascending: sortDirection === 'asc' })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as ProgramRow[];
    },
  });

  const invalidatePrograms = () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: ['programs-count'] });
  };

  /** Insert all selected package IDs across all four roles */
  const insertProgramPackages = async (
    programId: string,
    data: ProgramFormData,
  ) => {
    const rows: { program_id: string; package_id: string; role: string }[] = [];
    for (const role of ROLES) {
      const ids = data[ROLE_KEY[role]] as string[];
      for (const packageId of ids) {
        rows.push({ program_id: programId, package_id: packageId, role });
      }
    }
    if (rows.length > 0) {
      await supabase.from('program_packages').insert(rows);
    }
  };

  /** Diff a single role group and apply inserts / deletes */
  const diffRoleGroup = async (
    programId: string,
    role: string,
    newIds: string[],
  ) => {
    const { data: current } = await supabase
      .from('program_packages')
      .select('package_id')
      .eq('program_id', programId)
      .eq('role', role);

    const curIds = new Set((current ?? []).map((r) => r.package_id));
    const newSet = new Set(newIds);
    const toAdd = [...newSet].filter((id) => !curIds.has(id));
    const toRemove = [...curIds].filter((id) => !newSet.has(id));

    if (toAdd.length > 0) {
      await supabase
        .from('program_packages')
        .insert(toAdd.map((packageId) => ({ program_id: programId, package_id: packageId, role })));
    }
    for (const packageId of toRemove) {
      await supabase
        .from('program_packages')
        .delete()
        .eq('program_id', programId)
        .eq('package_id', packageId)
        .eq('role', role);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const { data: created, error } = await supabase
        .from('programs')
        .insert({
          program_id: data.program_id,
          name: data.name,
          tier: data.tier || null,
          monthly_price: data.monthly_price ? parseFloat(data.monthly_price) : null,
          one_time_price: data.one_time_price ? parseFloat(data.one_time_price) : null,
          status: data.status,
          client_fit: data.client_fit || null,
          optional_accelerators: data.optional_accelerators
            ? [data.optional_accelerators]
            : null,
        })
        .select('id, name')
        .single();
      if (error) throw error;
      if (created) {
        await insertProgramPackages(created.id, data);
      }
      return created;
    },
    onSuccess: async (created) => {
      invalidatePrograms();
      goToPage(1);
      if (created) {
        await activityLogger.logActivity('program_created', 'program', created.id, {
          name: created.name,
        });
      }
      toast.success('Program created successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProgramFormData }) => {
      const { data: updated, error } = await supabase
        .from('programs')
        .update({
          program_id: data.program_id,
          name: data.name,
          tier: data.tier || null,
          monthly_price: data.monthly_price ? parseFloat(data.monthly_price) : null,
          one_time_price: data.one_time_price ? parseFloat(data.one_time_price) : null,
          status: data.status,
          client_fit: data.client_fit || null,
          optional_accelerators: data.optional_accelerators
            ? [data.optional_accelerators]
            : null,
        })
        .eq('id', id)
        .select('id, name')
        .single();
      if (error) throw error;

      // Diff each role group independently
      await Promise.all(
        ROLES.map((role) =>
          diffRoleGroup(id, role, data[ROLE_KEY[role]] as string[]),
        ),
      );

      return updated;
    },
    onSuccess: async (updated) => {
      invalidatePrograms();
      if (updated) {
        await activityLogger.logActivity('program_updated', 'program', updated.id, {
          name: updated.name,
        });
      }
      toast.success('Program updated successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('programs').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      invalidatePrograms();
      goToPage(1);
      await activityLogger.logActivity('program_deleted', 'program', id, {});
      toast.success('Program deleted successfully');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingProgram(null);
    setIsDialogOpen(false);
  };

  const handleEdit = async (program: ProgramRow) => {
    setEditingProgram(program);

    const { data: pkgRows } = await supabase
      .from('program_packages')
      .select('package_id, role')
      .eq('program_id', program.id);

    const byRole = (role: string) =>
      (pkgRows ?? []).filter((r) => r.role === role).map((r) => r.package_id);

    setFormData({
      program_id: program.program_id,
      name: program.name,
      tier: program.tier ?? '',
      monthly_price: program.monthly_price != null ? String(program.monthly_price) : '',
      one_time_price: program.one_time_price != null ? String(program.one_time_price) : '',
      status: program.status,
      client_fit: program.client_fit ?? '',
      optional_accelerators: program.optional_accelerators?.[0] ?? '',
      visibilityPackageIds: byRole('visibility'),
      credibilityPackageIds: byRole('credibility'),
      convertibilityPackageIds: byRole('convertibility'),
      profitabilityPackageIds: byRole('profitability'),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.program_id.trim()) { toast.error('Program ID is required'); return; }
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = (key: keyof ProgramFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setFormData((f) => ({ ...f, [key]: e.target.value }));

  /** Build add/remove handlers for a given role key */
  const pickerHandlers = (roleKey: keyof ProgramFormData) => ({
    selectedPackageIds: formData[roleKey] as string[],
    onAdd: (ids: string[]) =>
      setFormData((f) => ({
        ...f,
        [roleKey]: [...new Set([...(f[roleKey] as string[]), ...ids])],
      })),
    onRemove: (id: string) =>
      setFormData((f) => ({
        ...f,
        [roleKey]: (f[roleKey] as string[]).filter((pid) => pid !== id),
      })),
  });

  const thSort = (col: string, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label} <SortIcon column={col} />
      </div>
    </TableHead>
  );

  const totalPackageCount = (prog: ProgramRow) => prog.program_packages?.length ?? 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Programs</h1>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-sm">{totalCount}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              Top-level bundles of Packages organised by pillar (Layer 3 catalog)
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}
          >
            <DialogTrigger asChild>
              <Button className="w-full shrink-0 gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Program
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProgram ? 'Edit Program' : 'Create Program'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {/* Core fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prog-program_id">
                      Program ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prog-program_id"
                      value={formData.program_id}
                      onChange={set('program_id')}
                      placeholder="e.g. PRG-FOUND-01"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prog-name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prog-name"
                      value={formData.name}
                      onChange={set('name')}
                      placeholder="Program name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prog-tier">Tier</Label>
                    <Select
                      value={formData.tier}
                      onValueChange={(v) => setFormData((f) => ({ ...f, tier: v }))}
                    >
                      <SelectTrigger id="prog-tier">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prog-monthly_price">Monthly Price ($)</Label>
                    <Input
                      id="prog-monthly_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.monthly_price}
                      onChange={set('monthly_price')}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prog-one_time_price">One-time Price ($)</Label>
                    <Input
                      id="prog-one_time_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.one_time_price}
                      onChange={set('one_time_price')}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prog-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger id="prog-status" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prog-client_fit">Client Fit</Label>
                  <Textarea
                    id="prog-client_fit"
                    value={formData.client_fit}
                    onChange={set('client_fit')}
                    placeholder="Who is this program designed for?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prog-optional_accelerators">Optional Accelerators</Label>
                  <Textarea
                    id="prog-optional_accelerators"
                    value={formData.optional_accelerators}
                    onChange={set('optional_accelerators')}
                    placeholder="Additional optional services or add-ons…"
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Per-pillar package pickers */}
                <div className="space-y-1">
                  <p className="text-sm font-medium">Packages included in this program</p>
                  <p className="text-xs text-muted-foreground">
                    Assign packages to each pillar role below.
                  </p>
                </div>

                {ROLES.map((role) => (
                  <div key={role} className="space-y-2 rounded-md border p-3">
                    <Label className="capitalize">{ROLE_LABEL[role]}</Label>
                    <PackagePicker
                      role={role}
                      {...pickerHandlers(ROLE_KEY[role])}
                    />
                  </div>
                ))}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingProgram ? (
                    'Update Program'
                  ) : (
                    'Create Program'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" />
              All Programs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (programsPage?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {totalCount === 0
                  ? 'No programs yet. Create your first program to get started.'
                  : 'No programs on this page.'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        {thSort('name', 'Name')}
                        {thSort('program_id', 'Program ID')}
                        {thSort('tier', 'Tier')}
                        {thSort('monthly_price', 'Monthly')}
                        <TableHead>One-time</TableHead>
                        <TableHead>Packages</TableHead>
                        {thSort('status', 'Status')}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {programsPage?.map((prog) => (
                        <TableRow key={prog.id}>
                          <TableCell>
                            <p className="font-medium">{prog.name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {prog.program_id}
                            </Badge>
                          </TableCell>
                          <TableCell>{tierBadge(prog.tier)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(prog.monthly_price)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(prog.one_time_price)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{totalPackageCount(prog)}</Badge>
                          </TableCell>
                          <TableCell>{statusBadge(prog.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(prog)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmDeleteDialog
                                title="Delete Program"
                                description={`Are you sure you want to delete "${prog.name}"? This action cannot be undone.`}
                                onConfirm={() => deleteMutation.mutate(prog.id)}
                                isLoading={deleteMutation.isPending}
                              />
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
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
