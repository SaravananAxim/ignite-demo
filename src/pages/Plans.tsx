import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, CreditCard, Loader2, Zap } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { activityLogger } from '@/lib/activityLogger';
import { decodeHtmlEntities } from '@/lib/utils';
import { PlanFormFields } from '@/components/plans/PlanFormFields';
import { type PlanFormData, type PlanCategory } from '@/components/plans/planFormTypes';
import { usePagination } from '@/hooks/usePagination';
import { useSort } from '@/hooks/useSort';

const PAGE_SIZE = 50;

interface Plan {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  monthly_price: number;
  stripe_payment_link: string;
  stripe_payment_link_with_media: string | null;
  stripe_price_id: string | null;
  stripe_price_id_with_media: string | null;
  supports_paid_media: boolean;
  requires_paid_media: boolean;
  category: PlanCategory;
  contract_template_id: string | null;
  display_order: number;
  status: string | null;
  created_at: string;
  brands?: { name: string; portals?: { name: string } };
  contract_templates?: { id: string; name: string };
  plan_skus?: { sku_id: string }[];
}

type PlansFormState = PlanFormData & { brand_id: string };

interface PickerSku {
  id: string;
  source_product: string;
}

interface Brand {
  id: string;
  name: string;
  portals?: { name: string };
}

interface ContractTemplate {
  id: string;
  name: string;
}

const SERVER_SORT_COLS = new Set(['name', 'monthly_price', 'category', 'status', 'created_at']);

export default function Plans() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreatingStripe, setIsCreatingStripe] = useState(false);
  const [formData, setFormData] = useState<PlansFormState>({
    brand_id: '',
    name: '',
    description: '',
    monthly_price: '',
    setup_fee: '',
    monthly_price_with_media: '',
    supports_paid_media: false,
    requires_paid_media: false,
    category: 'Other',
    contract_template_id: '',
    status: 'active',
    selectedSkuIds: [],
  });
  const queryClient = useQueryClient();

  const { sortColumn, sortDirection, toggleSort, SortIcon } = useSort({
    defaultColumn: 'created_at',
    defaultDirection: 'desc',
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['plans-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('plans')
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

  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('id, name, portals(name)');
      if (error) throw error;
      return data as Brand[];
    },
  });

  const { data: allSkus = [] } = useQuery<PickerSku[]>({
    queryKey: ['skus-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id,source_product')
        .order('source_product')
        .limit(2000);
      if (error) throw error;
      return data as PickerSku[];
    },
    staleTime: Infinity,
  });

  const skuById = new Map(allSkus.map((s) => [s.id, s]));

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans', sortColumn, sortDirection, currentPage],
    queryFn: async () => {
      const effectiveCol = SERVER_SORT_COLS.has(sortColumn) ? sortColumn : 'created_at';
      const { data, error } = await supabase
        .from('plans')
        .select('*, brands(name, portals(name)), contract_templates(id, name), plan_skus(sku_id)')
        .order(effectiveCol, { ascending: sortDirection === 'asc' })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as Plan[];
    },
  });

  const { data: contractTemplates } = useQuery({
    queryKey: ['contract-templates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });

  const createStripeProduct = async (planData: typeof formData) => {
    const selectedBrand = brands?.find(b => b.id === planData.brand_id);
    const brandName = selectedBrand?.name || 'Unknown Brand';
    const portalName = selectedBrand?.portals?.name || 'Unknown Portal';

    const { data, error } = await supabase.functions.invoke('create-stripe-product', {
      body: {
        planName: planData.name,
        brandName,
        portalName,
        description: decodeHtmlEntities(planData.description.replace(/<[^>]*>/g, '')).substring(0, 500),
        monthlyPrice: parseFloat(planData.monthly_price),
        monthlyPriceWithMedia: planData.supports_paid_media && planData.monthly_price_with_media
          ? parseFloat(planData.monthly_price_with_media)
          : undefined,
        supportsPaidMedia: planData.supports_paid_media,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as { productId: string; priceId: string; priceIdWithMedia: string | null };
  };

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    queryClient.invalidateQueries({ queryKey: ['plans-list'] });
    queryClient.invalidateQueries({ queryKey: ['plans-management'] });
    queryClient.invalidateQueries({ queryKey: ['plans-count'] });
    queryClient.invalidateQueries({ queryKey: ['plans-filter'] });
    queryClient.invalidateQueries({ queryKey: ['brand-plans'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsCreatingStripe(true);
      const { data: maxRow } = await supabase.from('plans').select('display_order').eq('brand_id', data.brand_id).order('display_order', { ascending: false }).limit(1).maybeSingle();
      const nextOrder = maxRow != null ? maxRow.display_order + 1 : 0;
      let stripeData: { productId: string; priceId: string; priceIdWithMedia: string | null } | null = null;
      try {
        stripeData = await createStripeProduct(data);
      } catch (err) {
        console.warn('Stripe product creation skipped:', err);
        toast({
          title: 'Plan saved',
          description: 'Stripe sync unavailable — connect Stripe to enable automatic product creation.',
          variant: 'default',
        });
      }
      const { data: created, error } = await supabase.from('plans').insert([{
        brand_id: data.brand_id,
        name: data.name,
        description: data.description,
        monthly_price: parseFloat(data.monthly_price),
        setup_fee: data.setup_fee ? parseFloat(data.setup_fee) : null,
        monthly_price_with_media: data.supports_paid_media && data.monthly_price_with_media
          ? parseFloat(data.monthly_price_with_media)
          : null,
        stripe_payment_link: '',
        stripe_payment_link_with_media: null,
        stripe_price_id: stripeData?.priceId ?? null,
        stripe_price_id_with_media: stripeData?.priceIdWithMedia ?? null,
        supports_paid_media: data.supports_paid_media,
        requires_paid_media: data.requires_paid_media,
        category: data.category,
        contract_template_id: data.contract_template_id || null,
        status: data.status,
        display_order: nextOrder,
      }]).select('id, name').single();
      if (error) throw error;
      if (created && data.selectedSkuIds.length > 0) {
        await supabase.from('plan_skus').insert(
          data.selectedSkuIds.map((skuId) => ({ plan_id: created.id, sku_id: skuId })),
        );
      }
      return created;
    },
    onSuccess: async (created) => {
      invalidatePlans();
      goToPage(1);
      if (created) {
        await activityLogger.logActivity('plan_created', 'plan', created.id, { name: created.name });
      }
      toast.success('Plan created with Stripe integration');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
    onSettled: () => { setIsCreatingStripe(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, originalPlan }: { id: string; data: typeof formData; originalPlan: Plan | null }) => {
      if (originalPlan?.stripe_price_id) {
        const selectedBrand = brands?.find(b => b.id === data.brand_id);
        const brandName = selectedBrand?.name || 'Unknown Brand';
        const portalName = selectedBrand?.portals?.name || 'Unknown Portal';
        const fullProductName = `${portalName} | ${brandName} | ${data.name}`;
        const { data: updateResult, error: stripeError } = await supabase.functions.invoke('update-stripe-product', {
          body: {
            stripePriceId: originalPlan.stripe_price_id,
            fullProductName,
            description: decodeHtmlEntities(data.description.replace(/<[^>]*>/g, '')).substring(0, 500),
          },
        });
        if (stripeError) throw new Error(stripeError.message);
        if (updateResult?.error) throw new Error(updateResult.error);
      }
      const { data: updated, error } = await supabase.from('plans').update({
        brand_id: data.brand_id,
        name: data.name,
        description: data.description,
        monthly_price: parseFloat(data.monthly_price),
        monthly_price_with_media: data.supports_paid_media && data.monthly_price_with_media
          ? parseFloat(data.monthly_price_with_media)
          : null,
        supports_paid_media: data.supports_paid_media,
        requires_paid_media: data.requires_paid_media,
        category: data.category,
        contract_template_id: data.contract_template_id || null,
        status: data.status,
      }).eq('id', id).select('id, name').single();
      if (error) throw error;

      // Diff plan_skus
      const { data: currentPlanSkus } = await supabase
        .from('plan_skus')
        .select('sku_id')
        .eq('plan_id', id);
      const currentIds = new Set((currentPlanSkus ?? []).map((ps) => ps.sku_id));
      const newIds = new Set(data.selectedSkuIds);
      const toAdd = [...newIds].filter((sid) => !currentIds.has(sid));
      const toRemove = [...currentIds].filter((sid) => !newIds.has(sid));
      if (toAdd.length > 0) {
        await supabase.from('plan_skus').insert(toAdd.map((skuId) => ({ plan_id: id, sku_id: skuId })));
      }
      for (const skuId of toRemove) {
        await supabase.from('plan_skus').delete().eq('plan_id', id).eq('sku_id', skuId);
      }

      return updated;
    },
    onSuccess: async (updated) => {
      invalidatePlans();
      if (updated) {
        await activityLogger.logActivity('plan_updated', 'plan', updated.id, { name: updated.name });
      }
      toast.success('Plan updated successfully');
      resetForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      invalidatePlans();
      goToPage(1);
      await activityLogger.logActivity('plan_deleted', 'plan', id, {});
      toast.success('Plan deleted successfully');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setFormData({
      brand_id: '',
      name: '',
      description: '',
      monthly_price: '',
      setup_fee: '',
      monthly_price_with_media: '',
      supports_paid_media: false,
      requires_paid_media: false,
      category: 'Other',
      contract_template_id: '',
      status: 'active',
      selectedSkuIds: [],
    });
    setEditingPlan(null);
    setIsDialogOpen(false);
  };

  const handleEdit = async (plan: Plan) => {
    setEditingPlan(plan);
    const { data: planSkus } = await supabase
      .from('plan_skus')
      .select('sku_id')
      .eq('plan_id', plan.id);
    setFormData({
      brand_id: plan.brand_id,
      name: plan.name,
      description: plan.description,
      monthly_price: plan.monthly_price.toString(),
      setup_fee: '',
      monthly_price_with_media: '',
      supports_paid_media: plan.supports_paid_media,
      requires_paid_media: plan.requires_paid_media,
      category: plan.category ?? 'Other',
      contract_template_id: plan.contract_template_id || '',
      status: plan.status || 'active',
      selectedSkuIds: (planSkus ?? []).map((ps) => ps.sku_id),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData, originalPlan: editingPlan });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const thSort = (col: string, label: string, minW = '100px') => (
    <TableHead
      className={`min-w-[${minW}] cursor-pointer select-none hover:bg-muted/50`}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Plans</h1>
            <p className="text-muted-foreground mt-1">Configure subscription plans with Stripe</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Select value={formData.brand_id} onValueChange={(value) => setFormData({ ...formData, brand_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger>
                    <SelectContent>
                      {brands?.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name} ({brand.portals?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <PlanFormFields
                  formData={formData}
                  setFormData={setFormData}
                  contractTemplates={contractTemplates}
                  isEditing={!!editingPlan}
                  showSetupFee={true}
                  showPaidMediaAddOn={!editingPlan}
                />
                {!editingPlan && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Zap className="w-4 h-4 text-primary" />
                    <p className="text-sm text-primary">Stripe product & pricing will be created automatically</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isPending || isCreatingStripe || !formData.brand_id}>
                  {(isPending || isCreatingStripe) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              All Plans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No plans yet. Create your first plan to get started.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        {thSort('name', 'Plan', '150px')}
                        {thSort('brand_id', 'Brand', '100px')}
                        {thSort('monthly_price', 'Price', '100px')}
                        {thSort('category', 'Category', '120px')}
                        {thSort('status', 'Status', '100px')}
                        <TableHead className="min-w-[100px]">Stripe</TableHead>
                        <TableHead className="min-w-[100px]">Paid Media</TableHead>
                        <TableHead className="min-w-[120px]">Contract</TableHead>
                        {thSort('created_at', 'Created', '100px')}
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans?.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <p className="font-medium">{plan.name}</p>
                              {(plan.plan_skus?.length ?? 0) > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="self-start"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Badge variant="secondary" className="cursor-pointer text-xs">
                                        {plan.plan_skus!.length} SKU{plan.plan_skus!.length !== 1 ? 's' : ''}
                                      </Badge>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">SKUs in this plan</p>
                                    <ul className="space-y-1">
                                      {plan.plan_skus!.map((ps) => (
                                        <li key={ps.sku_id} className="text-sm">
                                          {skuById.get(ps.sku_id)?.source_product ?? ps.sku_id}
                                        </li>
                                      ))}
                                    </ul>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-xs text-muted-foreground">No SKUs</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{plan.brands?.name}</TableCell>
                          <TableCell className="font-mono">${Number(plan.monthly_price).toFixed(2)}/mo</TableCell>
                          <TableCell><Badge variant="outline">{plan.category ?? 'Other'}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                              {plan.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {plan.stripe_price_id ? (
                              <Badge variant="default" className="gap-1"><Zap className="w-3 h-3" />Connected</Badge>
                            ) : (
                              <Badge variant="secondary">Not linked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {plan.requires_paid_media ? (
                              <Badge variant="destructive">Required</Badge>
                            ) : plan.supports_paid_media ? (
                              <Badge variant="default">Optional</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {plan.contract_templates?.name ? (
                              <Badge variant="outline" className="truncate max-w-[120px]">{plan.contract_templates.name}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(plan.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <ConfirmDeleteDialog
                                title="Delete Plan"
                                description={`Are you sure you want to delete "${plan.name}"? This action cannot be undone.`}
                                onConfirm={() => deleteMutation.mutate(plan.id)}
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
