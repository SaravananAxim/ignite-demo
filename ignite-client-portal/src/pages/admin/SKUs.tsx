import { useState, useMemo } from 'react';
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
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Tag, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { activityLogger } from '@/lib/activityLogger';
import { type Sku, SKU_STATUSES, SKU_CATEGORIES } from '@/types/sku';
import { usePagination } from '@/hooks/usePagination';
import { useSort } from '@/hooks/useSort';

const PAGE_SIZE = 50;
const BILLING_TYPES = ['Subscription', 'Package', 'One Time', 'Usage'] as const;

interface SkuFormData {
  source_product: string;
  source_family: string;
  product_code: string;
  billing_type: string;
  std_list_price: string;
  price_range: string;
  mapped_product_line: string;
  mapped_product_id: string;
  mapped_category: string;
  recommended_action: string;
  status: Sku['status'];
  notes: string;
  sf_id: string;
}

const EMPTY_FORM: SkuFormData = {
  source_product: '',
  source_family: '',
  product_code: '',
  billing_type: '',
  std_list_price: '',
  price_range: '',
  mapped_product_line: '',
  mapped_product_id: '',
  mapped_category: '',
  recommended_action: '',
  status: 'active',
  notes: '',
  sf_id: '',
};

function statusBadge(status: Sku['status']) {
  if (status === 'active') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  if (status === 'review') return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Review</Badge>;
  return <Badge variant="secondary">Archived</Badge>;
}

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

export default function SKUs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [formData, setFormData] = useState<SkuFormData>(EMPTY_FORM);

  // Client-side filters applied to the loaded page
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');
  const [filterBillingType, setFilterBillingType] = useState('__all__');

  const queryClient = useQueryClient();

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: 'source_product',
    defaultDirection: 'asc',
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['skus-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('skus')
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

  const { data: skusPage, isLoading } = useQuery({
    queryKey: ['skus', sortColumn, sortDirection, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('*')
        .order(sortColumn, { ascending: sortDirection === 'asc' })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as Sku[];
    },
  });

  const filteredSkus = useMemo(() => {
    if (!skusPage) return [];
    const q = searchQuery.toLowerCase().trim();
    return skusPage.filter((sku) => {
      if (q && !sku.source_product.toLowerCase().includes(q) && !(sku.product_code ?? '').toLowerCase().includes(q)) return false;
      if (filterCategory !== '__all__' && sku.mapped_category !== filterCategory) return false;
      if (filterStatus !== '__all__' && sku.status !== filterStatus) return false;
      if (filterBillingType !== '__all__' && sku.billing_type !== filterBillingType) return false;
      return true;
    });
  }, [skusPage, searchQuery, filterCategory, filterStatus, filterBillingType]);

  const invalidateSkus = () => {
    queryClient.invalidateQueries({ queryKey: ['skus'] });
    queryClient.invalidateQueries({ queryKey: ['skus-count'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: SkuFormData) => {
      const { data: created, error } = await supabase
        .from('skus')
        .insert({
          source_product: data.source_product,
          source_family: data.source_family || null,
          product_code: data.product_code || null,
          billing_type: data.billing_type || null,
          std_list_price: data.std_list_price ? parseFloat(data.std_list_price) : null,
          price_range: data.price_range || null,
          mapped_product_line: data.mapped_product_line || null,
          mapped_product_id: data.mapped_product_id || null,
          mapped_category: data.mapped_category || null,
          recommended_action: data.recommended_action || null,
          status: data.status,
          notes: data.notes || null,
          sf_id: data.sf_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return created as Sku;
    },
    onSuccess: async (created) => {
      invalidateSkus();
      goToPage(1);
      await activityLogger.logActivity('sku_created', 'sku', created.id, { name: created.source_product });
      toast.success('SKU created successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SkuFormData }) => {
      const { data: updated, error } = await supabase
        .from('skus')
        .update({
          source_product: data.source_product,
          source_family: data.source_family || null,
          product_code: data.product_code || null,
          billing_type: data.billing_type || null,
          std_list_price: data.std_list_price ? parseFloat(data.std_list_price) : null,
          price_range: data.price_range || null,
          mapped_product_line: data.mapped_product_line || null,
          mapped_product_id: data.mapped_product_id || null,
          mapped_category: data.mapped_category || null,
          recommended_action: data.recommended_action || null,
          status: data.status,
          notes: data.notes || null,
          sf_id: data.sf_id || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as Sku;
    },
    onSuccess: async (updated) => {
      invalidateSkus();
      await activityLogger.logActivity('sku_updated', 'sku', updated.id, { name: updated.source_product });
      toast.success('SKU updated successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('skus').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      invalidateSkus();
      goToPage(1);
      await activityLogger.logActivity('sku_deleted', 'sku', id, {});
      toast.success('SKU deleted successfully');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingSku(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (sku: Sku) => {
    setEditingSku(sku);
    setFormData({
      source_product: sku.source_product,
      source_family: sku.source_family ?? '',
      product_code: sku.product_code ?? '',
      billing_type: sku.billing_type ?? '',
      std_list_price: sku.std_list_price != null ? String(sku.std_list_price) : '',
      price_range: sku.price_range ?? '',
      mapped_product_line: sku.mapped_product_line ?? '',
      mapped_product_id: sku.mapped_product_id ?? '',
      mapped_category: sku.mapped_category ?? '',
      recommended_action: sku.recommended_action ?? '',
      status: sku.status,
      notes: sku.notes ?? '',
      sf_id: sku.sf_id ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source_product.trim()) { toast.error('Source product is required'); return; }
    if (editingSku) {
      updateMutation.mutate({ id: editingSku.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const field = (key: keyof SkuFormData) => ({
    value: formData[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData({ ...formData, [key]: e.target.value }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">SKU Catalog</h1>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-sm">{totalCount}</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">Manage service SKUs and product catalog</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Add SKU
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSku ? 'Edit SKU' : 'Create SKU'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="source_product">Source Product <span className="text-destructive">*</span></Label>
                  <Input id="source_product" {...field('source_product')} placeholder="e.g. Local SEO Starter" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source_family">Source Family</Label>
                    <Input id="source_family" {...field('source_family')} placeholder="e.g. SEO" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_code">Product Code</Label>
                    <Input id="product_code" {...field('product_code')} placeholder="e.g. SEO-001" className="font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_type">Billing Type</Label>
                    <Select value={formData.billing_type} onValueChange={(v) => setFormData({ ...formData, billing_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select billing type" /></SelectTrigger>
                      <SelectContent>
                        {BILLING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="std_list_price">Std. List Price</Label>
                    <Input id="std_list_price" type="number" min={0} step="0.01" {...field('std_list_price')} placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_range">Price Range</Label>
                  <Input id="price_range" {...field('price_range')} placeholder="e.g. $500 – $1,500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mapped_product_line">Mapped Product Line</Label>
                    <Input id="mapped_product_line" {...field('mapped_product_line')} placeholder="e.g. Local SEO" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mapped_product_id">Mapped Product ID</Label>
                    <Input id="mapped_product_id" {...field('mapped_product_id')} placeholder="Product identifier" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapped_category">Mapped Category</Label>
                  <Select value={formData.mapped_category} onValueChange={(v) => setFormData({ ...formData, mapped_category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {SKU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recommended_action">Recommended Action</Label>
                  <Input id="recommended_action" {...field('recommended_action')} placeholder="e.g. Migrate to new plan" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Sku['status'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SKU_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sf_id">Salesforce ID</Label>
                    <Input id="sf_id" {...field('sf_id')} placeholder="SF record ID" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes…" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingSku ? 'Update SKU' : 'Create SKU'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search product or code…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-60"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {SKU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBillingType} onValueChange={setFilterBillingType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Billing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Billing</SelectItem>
              {BILLING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {skusPage && (
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredSkus.length} result{filteredSkus.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5" />
              All SKUs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSkus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {totalCount === 0 ? 'No SKUs yet. Create your first SKU to get started.' : 'No SKUs match the current filters.'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('source_product')}>
                          <div className="flex items-center gap-1">Source Product <SortIcon column="source_product" /></div>
                        </TableHead>
                        <TableHead className="min-w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('source_family')}>
                          <div className="flex items-center gap-1">Family <SortIcon column="source_family" /></div>
                        </TableHead>
                        <TableHead className="min-w-[110px]">Code</TableHead>
                        <TableHead className="min-w-[180px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('mapped_category')}>
                          <div className="flex items-center gap-1">Category <SortIcon column="mapped_category" /></div>
                        </TableHead>
                        <TableHead className="min-w-[110px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('billing_type')}>
                          <div className="flex items-center gap-1">Billing <SortIcon column="billing_type" /></div>
                        </TableHead>
                        <TableHead className="min-w-[90px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('std_list_price')}>
                          <div className="flex items-center gap-1">Price <SortIcon column="std_list_price" /></div>
                        </TableHead>
                        <TableHead className="min-w-[140px]">Mapped To</TableHead>
                        <TableHead className="min-w-[90px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('status')}>
                          <div className="flex items-center gap-1">Status <SortIcon column="status" /></div>
                        </TableHead>
                        <TableHead className="text-right min-w-[90px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSkus.map((sku) => (
                        <TableRow key={sku.id}>
                          <TableCell><p className="font-medium">{sku.source_product}</p></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{sku.source_family ?? '—'}</TableCell>
                          <TableCell>
                            {sku.product_code ? (
                              <Badge variant="outline" className="font-mono text-xs">{sku.product_code}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{sku.mapped_category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>
                            {sku.billing_type ? (
                              <Badge variant="outline">{sku.billing_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatPrice(sku.std_list_price)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sku.mapped_product_id ?? '—'}</TableCell>
                          <TableCell>{statusBadge(sku.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(sku)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <ConfirmDeleteDialog
                                title="Delete SKU"
                                description={`Are you sure you want to delete "${sku.source_product}"? This action cannot be undone.`}
                                onConfirm={() => deleteMutation.mutate(sku.id)}
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
