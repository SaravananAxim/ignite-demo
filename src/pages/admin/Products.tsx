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
import { Plus, Pencil, Layers, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
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
  'Reputation & Trust',
  'Analytics & Profitability',
] as const;

const PILLARS = ['Visibility', 'Credibility', 'Convertibility', 'Profitability'] as const;
const STATUSES = ['active', 'draft', 'inactive'] as const;

interface ProductRow {
  id: string;
  product_id: string;
  name: string;
  product_line: string | null;
  primary_pillar: string | null;
  secondary_pillar: string | null;
  price_monthly: number | null;
  price_one_time: number | null;
  price_unit: number | null;
  billing_type: string | null;
  rollup_logic: string | null;
  status: string;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
  product_skus?: { sku_id: string }[];
}

interface ProductFormData {
  product_id: string;
  name: string;
  product_line: string;
  primary_pillar: string;
  secondary_pillar: string;
  price_monthly: string;
  price_one_time: string;
  price_unit: string;
  billing_type: string;
  status: string;
  rollup_logic: string;
  selectedSkuIds: string[];
}

const EMPTY_FORM: ProductFormData = {
  product_id: '',
  name: '',
  product_line: '',
  primary_pillar: '',
  secondary_pillar: '',
  price_monthly: '',
  price_one_time: '',
  price_unit: '',
  billing_type: '',
  status: 'active',
  rollup_logic: '',
  selectedSkuIds: [],
};

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

function statusBadge(status: string) {
  if (status === 'active')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  if (status === 'draft') return <Badge variant="outline">Draft</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

export default function Products() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);

  const queryClient = useQueryClient();

  const SERVER_SORT_COLS = new Set([
    'product_id', 'name', 'product_line', 'primary_pillar',
    'price_monthly', 'status', 'created_at',
  ]);

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: 'product_line',
    defaultDirection: 'asc',
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['products-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
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

  const { data: productsPage, isLoading } = useQuery({
    queryKey: ['products', sortColumn, sortDirection, currentPage],
    queryFn: async () => {
      const effectiveCol = SERVER_SORT_COLS.has(sortColumn) ? sortColumn : 'product_line';
      const { data, error } = await supabase
        .from('products')
        .select('*, product_skus(sku_id)')
        .order(effectiveCol, { ascending: sortDirection === 'asc' })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as ProductRow[];
    },
  });

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['products-count'] });
    queryClient.invalidateQueries({ queryKey: ['products-all'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          product_id: data.product_id,
          name: data.name,
          product_line: data.product_line || null,
          primary_pillar: data.primary_pillar || null,
          secondary_pillar: data.secondary_pillar || null,
          price_monthly: data.price_monthly ? parseFloat(data.price_monthly) : null,
          price_one_time: data.price_one_time ? parseFloat(data.price_one_time) : null,
          price_unit: data.price_unit ? parseFloat(data.price_unit) : null,
          billing_type: data.billing_type || null,
          status: data.status,
          rollup_logic: data.rollup_logic || null,
        })
        .select('id, name')
        .single();
      if (error) throw error;

      if (created && data.selectedSkuIds.length > 0) {
        await supabase.from('product_skus').insert(
          data.selectedSkuIds.map((sid) => ({ product_id: created.id, sku_id: sid })),
        );
      }
      return created;
    },
    onSuccess: async (created) => {
      invalidateProducts();
      goToPage(1);
      if (created) {
        await activityLogger.logActivity('product_created', 'product', created.id, {
          name: created.name,
        });
      }
      toast.success('Product created successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const { data: updated, error } = await supabase
        .from('products')
        .update({
          product_id: data.product_id,
          name: data.name,
          product_line: data.product_line || null,
          primary_pillar: data.primary_pillar || null,
          secondary_pillar: data.secondary_pillar || null,
          price_monthly: data.price_monthly ? parseFloat(data.price_monthly) : null,
          price_one_time: data.price_one_time ? parseFloat(data.price_one_time) : null,
          price_unit: data.price_unit ? parseFloat(data.price_unit) : null,
          billing_type: data.billing_type || null,
          status: data.status,
          rollup_logic: data.rollup_logic || null,
        })
        .eq('id', id)
        .select('id, name')
        .single();
      if (error) throw error;

      // Diff product_skus
      const { data: curSkus } = await supabase
        .from('product_skus')
        .select('sku_id')
        .eq('product_id', id);
      const curSkuIds = new Set((curSkus ?? []).map((r) => r.sku_id));
      const newSkuIds = new Set(data.selectedSkuIds);
      const skusToAdd = [...newSkuIds].filter((sid) => !curSkuIds.has(sid));
      const skusToRemove = [...curSkuIds].filter((sid) => !newSkuIds.has(sid));
      if (skusToAdd.length > 0) {
        await supabase
          .from('product_skus')
          .insert(skusToAdd.map((sid) => ({ product_id: id, sku_id: sid })));
      }
      for (const sid of skusToRemove) {
        await supabase.from('product_skus').delete().eq('product_id', id).eq('sku_id', sid);
      }

      return updated;
    },
    onSuccess: async (updated) => {
      invalidateProducts();
      if (updated) {
        await activityLogger.logActivity('product_updated', 'product', updated.id, {
          name: updated.name,
        });
      }
      toast.success('Product updated successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      invalidateProducts();
      goToPage(1);
      await activityLogger.logActivity('product_deleted', 'product', id, {});
      toast.success('Product deleted successfully');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const handleEdit = async (product: ProductRow) => {
    setEditingProduct(product);

    const { data: skuRows } = await supabase
      .from('product_skus')
      .select('sku_id')
      .eq('product_id', product.id);

    setFormData({
      product_id: product.product_id,
      name: product.name,
      product_line: product.product_line ?? '',
      primary_pillar: product.primary_pillar ?? '',
      secondary_pillar: product.secondary_pillar ?? '',
      price_monthly: product.price_monthly != null ? String(product.price_monthly) : '',
      price_one_time: product.price_one_time != null ? String(product.price_one_time) : '',
      price_unit: product.price_unit != null ? String(product.price_unit) : '',
      billing_type: product.billing_type ?? '',
      status: product.status,
      rollup_logic: product.rollup_logic ?? '',
      selectedSkuIds: (skuRows ?? []).map((r) => r.sku_id),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id.trim()) { toast.error('Product ID is required'); return; }
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = (key: keyof ProductFormData) => (
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
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Products</h1>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-sm">{totalCount}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              Rollups of SKUs into named deliverables (Layer 1 catalog)
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}
          >
            <DialogTrigger asChild>
              <Button className="w-full shrink-0 gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {/* Product ID + Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod-product_id">
                      Product ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prod-product_id"
                      value={formData.product_id}
                      onChange={set('product_id')}
                      placeholder="e.g. VIS-SEO-002"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prod-name"
                      value={formData.name}
                      onChange={set('name')}
                      placeholder="Product name"
                    />
                  </div>
                </div>

                {/* Product Line */}
                <div className="space-y-2">
                  <Label htmlFor="prod-product_line">Product Line</Label>
                  <Select
                    value={formData.product_line}
                    onValueChange={(v) => setFormData((f) => ({ ...f, product_line: v }))}
                  >
                    <SelectTrigger id="prod-product_line">
                      <SelectValue placeholder="Select product line" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_LINES.map((pl) => (
                        <SelectItem key={pl} value={pl}>{pl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pillars */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod-primary_pillar">Primary Pillar</Label>
                    <Select
                      value={formData.primary_pillar}
                      onValueChange={(v) => setFormData((f) => ({ ...f, primary_pillar: v }))}
                    >
                      <SelectTrigger id="prod-primary_pillar">
                        <SelectValue placeholder="Select pillar" />
                      </SelectTrigger>
                      <SelectContent>
                        {PILLARS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-secondary_pillar">Secondary Pillar</Label>
                    <Select
                      value={formData.secondary_pillar}
                      onValueChange={(v) => setFormData((f) => ({ ...f, secondary_pillar: v }))}
                    >
                      <SelectTrigger id="prod-secondary_pillar">
                        <SelectValue placeholder="Select pillar" />
                      </SelectTrigger>
                      <SelectContent>
                        {PILLARS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod-price_monthly">Monthly Price ($)</Label>
                    <Input
                      id="prod-price_monthly"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.price_monthly}
                      onChange={set('price_monthly')}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-price_one_time">One-time Price ($)</Label>
                    <Input
                      id="prod-price_one_time"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.price_one_time}
                      onChange={set('price_one_time')}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-price_unit">Price Unit ($)</Label>
                    <Input
                      id="prod-price_unit"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.price_unit}
                      onChange={set('price_unit')}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Billing Type + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod-billing_type">Billing Type</Label>
                    <Input
                      id="prod-billing_type"
                      value={formData.billing_type}
                      onChange={set('billing_type')}
                      placeholder="e.g. Subscription"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger id="prod-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* SKUs section */}
                <div className="space-y-2">
                  <Label>SKUs included in this product</Label>
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

                <Separator />

                {/* Rollup Logic / Notes */}
                <div className="space-y-2">
                  <Label htmlFor="prod-rollup_logic">Rollup Logic / Notes</Label>
                  <Textarea
                    id="prod-rollup_logic"
                    value={formData.rollup_logic}
                    onChange={set('rollup_logic')}
                    placeholder="How SKUs roll up into this product, or any internal notes…"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingProduct ? (
                    'Update Product'
                  ) : (
                    'Create Product'
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
              <Layers className="h-5 w-5" />
              All Products
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (productsPage?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {totalCount === 0
                  ? 'No products yet. Create your first product to get started.'
                  : 'No products on this page.'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow>
                        {thSort('name', 'Name')}
                        {thSort('product_id', 'Product ID')}
                        {thSort('product_line', 'Product Line')}
                        {thSort('primary_pillar', 'Primary Pillar')}
                        {thSort('price_monthly', 'Monthly')}
                        <TableHead>One-time</TableHead>
                        <TableHead>SKUs</TableHead>
                        {thSort('status', 'Status')}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsPage?.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <p className="font-medium">{product.name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {product.product_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.product_line ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.primary_pillar ?? '—'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(product.price_monthly)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(product.price_one_time)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {product.product_skus?.length ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell>{statusBadge(product.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmDeleteDialog
                                title="Delete Product"
                                description={`Are you sure you want to delete "${product.name}"? This action cannot be undone.`}
                                onConfirm={() => deleteMutation.mutate(product.id)}
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
