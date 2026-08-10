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
import { Plus, Pencil, Package, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ProductPicker } from '@/components/ui/product-picker';
import { SkuPicker } from '@/components/ui/sku-picker';
import { activityLogger } from '@/lib/activityLogger';
import { usePagination } from '@/hooks/usePagination';
import { useSort } from '@/hooks/useSort';

const PAGE_SIZE = 50;

const PRODUCT_LINES = [
  'Organic Search & Local Visibility',
  'Paid Media',
  'Social & Content',
  'Website & Conversion',
  'Analytics & Profitability',
  'Reputation & Trust',
  'Other / Legacy / Admin',
] as const;

const TIERS = ['Good', 'Better', 'Best'] as const;
const STATUSES = ['Active', 'Draft', 'Inactive'] as const;

interface PackageRow {
  id: string;
  package_id: string;
  name: string;
  product_line: string | null;
  tier: string | null;
  monthly_price: number | null;
  one_time_price: number | null;
  pillar_coverage: string[] | null;
  intended_fit: string | null;
  status: string;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
  package_products?: { product_id: string }[];
  package_skus?: { sku_id: string }[];
}

interface PackageFormData {
  package_id: string;
  name: string;
  product_line: string;
  tier: string;
  monthly_price: string;
  one_time_price: string;
  status: string;
  pillar_coverage: string;
  intended_fit: string;
  selectedProductIds: string[];
  selectedSkuIds: string[];
}

const EMPTY_FORM: PackageFormData = {
  package_id: '',
  name: '',
  product_line: '',
  tier: '',
  monthly_price: '',
  one_time_price: '',
  status: 'Active',
  pillar_coverage: '',
  intended_fit: '',
  selectedProductIds: [],
  selectedSkuIds: [],
};

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

function tierBadge(tier: string | null) {
  if (!tier) return <span className="text-sm text-muted-foreground">—</span>;
  if (tier === 'Best')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Best</Badge>;
  if (tier === 'Better')
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Better</Badge>;
  return <Badge variant="secondary">Good</Badge>;
}

function statusBadge(status: string) {
  if (status === 'Active')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  if (status === 'Draft') return <Badge variant="outline">Draft</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

export default function Packages() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(EMPTY_FORM);

  const queryClient = useQueryClient();

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: 'product_line',
    defaultDirection: 'asc',
  });

  const SERVER_SORT_COLS = new Set(['package_id', 'name', 'product_line', 'tier', 'monthly_price', 'status', 'created_at']);

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['packages-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('packages')
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

  const { data: packagesPage, isLoading } = useQuery({
    queryKey: ['packages', sortColumn, sortDirection, currentPage],
    queryFn: async () => {
      const effectiveCol = SERVER_SORT_COLS.has(sortColumn) ? sortColumn : 'product_line';
      const { data, error } = await supabase
        .from('packages')
        .select('*, package_products(product_id), package_skus(sku_id)')
        .order(effectiveCol, { ascending: sortDirection === 'asc' })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as PackageRow[];
    },
  });

  const invalidatePackages = () => {
    queryClient.invalidateQueries({ queryKey: ['packages'] });
    queryClient.invalidateQueries({ queryKey: ['packages-count'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const { data: created, error } = await supabase
        .from('packages')
        .insert({
          package_id: data.package_id,
          name: data.name,
          product_line: data.product_line || null,
          tier: data.tier || null,
          monthly_price: data.monthly_price ? parseFloat(data.monthly_price) : null,
          one_time_price: data.one_time_price ? parseFloat(data.one_time_price) : null,
          status: data.status,
          pillar_coverage: data.pillar_coverage ? [data.pillar_coverage] : null,
          intended_fit: data.intended_fit || null,
        })
        .select('id, name')
        .single();
      if (error) throw error;

      if (created && data.selectedProductIds.length > 0) {
        await supabase.from('package_products').insert(
          data.selectedProductIds.map((pid) => ({ package_id: created.id, product_id: pid })),
        );
      }
      if (created && data.selectedSkuIds.length > 0) {
        await supabase.from('package_skus').insert(
          data.selectedSkuIds.map((sid) => ({ package_id: created.id, sku_id: sid })),
        );
      }
      return created;
    },
    onSuccess: async (created) => {
      invalidatePackages();
      goToPage(1);
      if (created) {
        await activityLogger.logActivity('package_created', 'package', created.id, { name: created.name });
      }
      toast.success('Package created successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PackageFormData }) => {
      const { data: updated, error } = await supabase
        .from('packages')
        .update({
          package_id: data.package_id,
          name: data.name,
          product_line: data.product_line || null,
          tier: data.tier || null,
          monthly_price: data.monthly_price ? parseFloat(data.monthly_price) : null,
          one_time_price: data.one_time_price ? parseFloat(data.one_time_price) : null,
          status: data.status,
          pillar_coverage: data.pillar_coverage ? [data.pillar_coverage] : null,
          intended_fit: data.intended_fit || null,
        })
        .eq('id', id)
        .select('id, name')
        .single();
      if (error) throw error;

      // Diff package_products
      const { data: curProds } = await supabase
        .from('package_products')
        .select('product_id')
        .eq('package_id', id);
      const curProdIds = new Set((curProds ?? []).map((r) => r.product_id));
      const newProdIds = new Set(data.selectedProductIds);
      const prodsToAdd = [...newProdIds].filter((pid) => !curProdIds.has(pid));
      const prodsToRemove = [...curProdIds].filter((pid) => !newProdIds.has(pid));
      if (prodsToAdd.length > 0) {
        await supabase
          .from('package_products')
          .insert(prodsToAdd.map((pid) => ({ package_id: id, product_id: pid })));
      }
      for (const pid of prodsToRemove) {
        await supabase.from('package_products').delete().eq('package_id', id).eq('product_id', pid);
      }

      // Diff package_skus
      const { data: curSkus } = await supabase
        .from('package_skus')
        .select('sku_id')
        .eq('package_id', id);
      const curSkuIds = new Set((curSkus ?? []).map((r) => r.sku_id));
      const newSkuIds = new Set(data.selectedSkuIds);
      const skusToAdd = [...newSkuIds].filter((sid) => !curSkuIds.has(sid));
      const skusToRemove = [...curSkuIds].filter((sid) => !newSkuIds.has(sid));
      if (skusToAdd.length > 0) {
        await supabase
          .from('package_skus')
          .insert(skusToAdd.map((sid) => ({ package_id: id, sku_id: sid })));
      }
      for (const sid of skusToRemove) {
        await supabase.from('package_skus').delete().eq('package_id', id).eq('sku_id', sid);
      }

      return updated;
    },
    onSuccess: async (updated) => {
      invalidatePackages();
      if (updated) {
        await activityLogger.logActivity('package_updated', 'package', updated.id, { name: updated.name });
      }
      toast.success('Package updated successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      invalidatePackages();
      goToPage(1);
      await activityLogger.logActivity('package_deleted', 'package', id, {});
      toast.success('Package deleted successfully');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingPackage(null);
    setIsDialogOpen(false);
  };

  const handleEdit = async (pkg: PackageRow) => {
    setEditingPackage(pkg);

    const [{ data: prodRows }, { data: skuRows }] = await Promise.all([
      supabase.from('package_products').select('product_id').eq('package_id', pkg.id),
      supabase.from('package_skus').select('sku_id').eq('package_id', pkg.id),
    ]);

    setFormData({
      package_id: pkg.package_id,
      name: pkg.name,
      product_line: pkg.product_line ?? '',
      tier: pkg.tier ?? '',
      monthly_price: pkg.monthly_price != null ? String(pkg.monthly_price) : '',
      one_time_price: pkg.one_time_price != null ? String(pkg.one_time_price) : '',
      status: pkg.status,
      pillar_coverage: pkg.pillar_coverage?.[0] ?? '',
      intended_fit: pkg.intended_fit ?? '',
      selectedProductIds: (prodRows ?? []).map((r) => r.product_id),
      selectedSkuIds: (skuRows ?? []).map((r) => r.sku_id),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.package_id.trim()) { toast.error('Package ID is required'); return; }
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = (key: keyof PackageFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setFormData((f) => ({ ...f, [key]: e.target.value }));

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Packages</h1>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-sm">{totalCount}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              Bundles of Products and individual SKUs (Layer 2 catalog)
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}
          >
            <DialogTrigger asChild>
              <Button className="w-full shrink-0 gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {/* Core fields grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pkg-package_id">
                      Package ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pkg-package_id"
                      value={formData.package_id}
                      onChange={set('package_id')}
                      placeholder="e.g. PKG-SEO-01"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pkg-name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pkg-name"
                      value={formData.name}
                      onChange={set('name')}
                      placeholder="Package name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pkg-product_line">Product Line</Label>
                    <Select
                      value={formData.product_line}
                      onValueChange={(v) => setFormData((f) => ({ ...f, product_line: v }))}
                    >
                      <SelectTrigger id="pkg-product_line">
                        <SelectValue placeholder="Select product line" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_LINES.map((pl) => (
                          <SelectItem key={pl} value={pl}>{pl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pkg-tier">Tier</Label>
                    <Select
                      value={formData.tier}
                      onValueChange={(v) => setFormData((f) => ({ ...f, tier: v }))}
                    >
                      <SelectTrigger id="pkg-tier">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pkg-monthly_price">Monthly Price ($)</Label>
                    <Input
                      id="pkg-monthly_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.monthly_price}
                      onChange={set('monthly_price')}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pkg-one_time_price">One-time Price ($)</Label>
                    <Input
                      id="pkg-one_time_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.one_time_price}
                      onChange={set('one_time_price')}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pkg-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger id="pkg-status">
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
                    <Label htmlFor="pkg-pillar_coverage">Pillar Coverage</Label>
                    <Input
                      id="pkg-pillar_coverage"
                      value={formData.pillar_coverage}
                      onChange={set('pillar_coverage')}
                      placeholder="e.g. Visibility, Credibility"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pkg-intended_fit">Intended Fit</Label>
                  <Textarea
                    id="pkg-intended_fit"
                    value={formData.intended_fit}
                    onChange={set('intended_fit')}
                    placeholder="Who is this package for?"
                    rows={3}
                  />
                </div>

                <Separator />

                {/* Products section */}
                <div className="space-y-2">
                  <Label>Products included in this package</Label>
                  <ProductPicker
                    selectedProductIds={formData.selectedProductIds}
                    onAdd={(ids) =>
                      setFormData((f) => ({
                        ...f,
                        selectedProductIds: [...new Set([...f.selectedProductIds, ...ids])],
                      }))
                    }
                    onRemove={(id) =>
                      setFormData((f) => ({
                        ...f,
                        selectedProductIds: f.selectedProductIds.filter((pid) => pid !== id),
                      }))
                    }
                  />
                </div>

                {/* Cross-reference note */}
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  SKUs already covered by the Products above are shown for reference only — no need to add them again.
                </p>

                {/* Individual SKUs section */}
                <div className="space-y-2">
                  <Label>Individual SKUs (added directly, not via a Product)</Label>
                  <SkuPicker
                    selectedSkuIds={formData.selectedSkuIds}
                    onAdd={(ids) =>
                      setFormData((f) => ({
                        ...f,
                        selectedSkuIds: [...new Set([...f.selectedSkuIds, ...ids])],
                      }))
                    }
                    onRemove={(id) =>
                      setFormData((f) => ({
                        ...f,
                        selectedSkuIds: f.selectedSkuIds.filter((sid) => sid !== id),
                      }))
                    }
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingPackage ? (
                    'Update Package'
                  ) : (
                    'Create Package'
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
              <Package className="h-5 w-5" />
              All Packages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (packagesPage?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {totalCount === 0
                  ? 'No packages yet. Create your first package to get started.'
                  : 'No packages on this page.'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        {thSort('name', 'Name')}
                        {thSort('package_id', 'Package ID')}
                        {thSort('product_line', 'Product Line')}
                        {thSort('tier', 'Tier')}
                        {thSort('monthly_price', 'Monthly')}
                        <TableHead>One-time</TableHead>
                        <TableHead>Products</TableHead>
                        <TableHead>SKUs</TableHead>
                        {thSort('status', 'Status')}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packagesPage?.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell>
                            <p className="font-medium">{pkg.name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {pkg.package_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pkg.product_line ?? '—'}
                          </TableCell>
                          <TableCell>{tierBadge(pkg.tier)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(pkg.monthly_price)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(pkg.one_time_price)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {pkg.package_products?.length ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {pkg.package_skus?.length ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell>{statusBadge(pkg.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(pkg)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmDeleteDialog
                                title="Delete Package"
                                description={`Are you sure you want to delete "${pkg.name}"? This action cannot be undone.`}
                                onConfirm={() => deleteMutation.mutate(pkg.id)}
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
