import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { toast } from '@/hooks/use-toast';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Plus, Pencil, Building2, Loader2, CreditCard, Zap, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { decodeHtmlEntities } from '@/lib/utils';
import { PlanFormFields } from '@/components/plans/PlanFormFields';
import { type PlanFormData, type PlanCategory } from '@/components/plans/planFormTypes';

interface Portal {
  id: string;
  name: string;
  subdomain: string;
}

interface Brand {
  id: string;
  portal_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  created_at: string;
}

interface Plan {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  monthly_price: number;
  monthly_price_with_media: number | null;
  setup_fee: number | null;
  supports_paid_media: boolean;
  requires_paid_media: boolean;
  category: PlanCategory;
  stripe_price_id: string | null;
  stripe_price_id_with_media: string | null;
  contract_template_id: string | null;
  display_order: number;
  status: string | null;
  created_at: string;
  contract_templates?: { id: string; name: string } | null;
}

interface ContractTemplate {
  id: string;
  name: string;
}

export default function BrandDetail() {
  const { portalId, brandId } = useParams<{ portalId: string; brandId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Plan form state
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreatingStripe, setIsCreatingStripe] = useState(false);
  const [planFormData, setPlanFormData] = useState<PlanFormData>({
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
  });

  // Fetch portal
  const { data: portal } = useQuery({
    queryKey: ['portal', portalId],
    queryFn: async () => {
      if (!portalId) return null;
      const { data, error } = await supabase
        .from('portals')
        .select('id, name, subdomain')
        .eq('id', portalId)
        .single();
      if (error) throw error;
      return data as Portal;
    },
    enabled: !!portalId,
  });

  // Fetch brand
  const { data: brand, isLoading: isLoadingBrand } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();
      if (error) throw error;
      return data as Brand;
    },
    enabled: !!brandId,
  });

  // Fetch plans for this brand
  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['brand-plans', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const { data, error } = await supabase
        .from('plans')
        .select('*, contract_templates(id, name)')
        .eq('brand_id', brandId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!brandId,
  });

  // Fetch contract templates
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

  // Plan mutations
  const createStripeProduct = async (planData: typeof planFormData) => {
    // Mock Stripe IDs generation locally since edge functions are not available
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    return {
      productId: `prod_mock_${randomSuffix}`,
      priceId: `price_mock_${randomSuffix}`,
      priceIdWithMedia: planData.supports_paid_media ? `price_mock_media_${randomSuffix}` : null,
    };
  };

  const recreateStripePricingMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      setIsCreatingStripe(true);
      // Create new Stripe product and prices
      const stripeData = await createStripeProduct({
        name: plan.name,
        description: plan.description,
        monthly_price: plan.monthly_price.toString(),
        setup_fee: plan.setup_fee?.toString() || '',
        monthly_price_with_media: plan.monthly_price_with_media?.toString() || '',
        supports_paid_media: plan.supports_paid_media,
        requires_paid_media: plan.requires_paid_media,
          category: plan.category ?? 'Other',
        contract_template_id: plan.contract_template_id || '',
        status: plan.status || 'active',
      });

      // Update the plan with new Stripe IDs
      const { error } = await supabase.from('plans').update({
        stripe_price_id: stripeData.priceId,
        stripe_price_id_with_media: stripeData.priceIdWithMedia,
      }).eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-plans', brandId] });
      toast.success('Stripe pricing recreated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsCreatingStripe(false);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof planFormData) => {
      if (!brandId) throw new Error('No brand selected');
      setIsCreatingStripe(true);
      const stripeData = await createStripeProduct(data);

      const currentPlans = queryClient.getQueryData<Plan[]>(['brand-plans', brandId]) ?? [];
      const nextOrder = currentPlans.length > 0 ? Math.max(...currentPlans.map((p) => p.display_order)) + 1 : 0;
      const { error } = await supabase.from('plans').insert([{
        brand_id: brandId,
        name: data.name,
        description: data.description,
        monthly_price: parseFloat(data.monthly_price),
        monthly_price_with_media: data.supports_paid_media && data.monthly_price_with_media 
          ? parseFloat(data.monthly_price_with_media) 
          : null,
        setup_fee: data.setup_fee ? parseFloat(data.setup_fee) : null,
        stripe_payment_link: '',
        stripe_payment_link_with_media: null,
        stripe_price_id: stripeData.priceId,
        stripe_price_id_with_media: stripeData.priceIdWithMedia,
        supports_paid_media: data.supports_paid_media,
        requires_paid_media: data.requires_paid_media,
        category: data.category,
        contract_template_id: data.contract_template_id || null,
        status: data.status,
        display_order: nextOrder,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-plans', brandId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      toast.success('Plan created with Stripe integration');
      resetPlanForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsCreatingStripe(false);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, data, originalPlan }: { planId: string; data: typeof planFormData; originalPlan: Plan }) => {
      const newMonthlyPrice = parseFloat(data.monthly_price);
      const newMediaPrice = data.supports_paid_media && data.monthly_price_with_media 
        ? parseFloat(data.monthly_price_with_media) 
        : null;
      
      // Check if pricing changed - if so, recreate Stripe prices
      const priceChanged = newMonthlyPrice !== originalPlan.monthly_price;
      const mediaPriceChanged = newMediaPrice !== originalPlan.monthly_price_with_media;
      
      let stripeUpdate: { stripe_price_id?: string; stripe_price_id_with_media?: string | null } = {};
      
      if (priceChanged || mediaPriceChanged) {
        setIsCreatingStripe(true);
        const stripeData = await createStripeProduct(data);
        stripeUpdate = {
          stripe_price_id: stripeData.priceId,
          stripe_price_id_with_media: stripeData.priceIdWithMedia,
        };
      } else if (originalPlan.stripe_price_id) {
        // Stripe integration bypassed/mocked: Skip invoking update-stripe-product edge function
        console.log('Stripe update skipped (edge functions bypassed)');
      }

      const { error } = await supabase.from('plans').update({
        name: data.name,
        description: data.description,
        monthly_price: newMonthlyPrice,
        monthly_price_with_media: newMediaPrice,
        setup_fee: data.setup_fee ? parseFloat(data.setup_fee) : null,
        supports_paid_media: data.supports_paid_media,
        requires_paid_media: data.requires_paid_media,
        category: data.category,
        contract_template_id: data.contract_template_id || null,
        status: data.status,
        ...stripeUpdate,
      }).eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-plans', brandId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      toast.success('Plan updated successfully');
      resetPlanForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsCreatingStripe(false);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-plans', brandId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      toast.success('Plan deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reorderPlanMutation = useMutation({
    mutationFn: async ({ plan, direction }: { plan: Plan; direction: 'up' | 'down' }) => {
      const currentPlans = queryClient.getQueryData<Plan[]>(['brand-plans', brandId]) ?? [];
      const idx = currentPlans.findIndex((p) => p.id === plan.id);
      if (idx < 0) return;
      const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (neighborIdx < 0 || neighborIdx >= currentPlans.length) return;
      const neighbor = currentPlans[neighborIdx];
      const planOrder = plan.display_order;
      const neighborOrder = neighbor.display_order;
      await supabase.from('plans').update({ display_order: neighborOrder }).eq('id', plan.id);
      await supabase.from('plans').update({ display_order: planOrder }).eq('id', neighbor.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-plans', brandId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      toast.success('Order updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetPlanForm = () => {
    setPlanFormData({
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
    });
    setEditingPlan(null);
    setIsPlanDialogOpen(false);
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanFormData({
      name: plan.name,
      description: plan.description,
      monthly_price: plan.monthly_price.toString(),
      setup_fee: plan.setup_fee?.toString() || '',
      monthly_price_with_media: plan.monthly_price_with_media?.toString() || '',
      supports_paid_media: plan.supports_paid_media,
      requires_paid_media: plan.requires_paid_media,
      category: plan.category ?? 'Other',
      contract_template_id: plan.contract_template_id || '',
      status: plan.status || 'active',
    });
    setIsPlanDialogOpen(true);
  };

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updatePlanMutation.mutate({ planId: editingPlan.id, data: planFormData, originalPlan: editingPlan });
    } else {
      createPlanMutation.mutate(planFormData);
    }
  };

  const isPlanPending = createPlanMutation.isPending || updatePlanMutation.isPending;

  if (isLoadingBrand) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!brand) {
    return (
      <AdminLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Brand not found</p>
          <Button variant="link" onClick={() => navigate('/portals')}>
            Back to Portals
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="min-w-0 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/portals">Portals</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/portals/${portalId}`}>
                {portal?.name || 'Portal'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{brand.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar className="w-16 h-16">
              <AvatarImage src={brand.logo_url || undefined} />
              <AvatarFallback
                className="text-xl font-medium"
                style={{ backgroundColor: brand.primary_color || undefined }}
              >
                {brand.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">{brand.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: brand.primary_color || '#3B82F6' }}
                  />
                  <span className="text-sm text-muted-foreground">Primary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: brand.accent_color || '#10B981' }}
                  />
                  <span className="text-sm text-muted-foreground">Accent</span>
                </div>
              </div>
            </div>
          </div>
          <span className="text-sm text-muted-foreground shrink-0 sm:text-right">
            Created {format(new Date(brand.created_at), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Plans Section */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Plans
              </CardTitle>
              <CardDescription>
                {plans?.length || 0} plan{plans?.length !== 1 ? 's' : ''} for this brand
              </CardDescription>
            </div>
            <Dialog open={isPlanDialogOpen} onOpenChange={(open) => {
              setIsPlanDialogOpen(open);
              if (!open) resetPlanForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 w-full sm:w-auto shrink-0">
                  <Plus className="w-4 h-4" />
                  Add Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingPlan ? 'Edit Plan' : 'Add Plan'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePlanSubmit} className="space-y-4 mt-4">
                  <PlanFormFields
                    formData={planFormData}
                    setFormData={setPlanFormData}
                    contractTemplates={contractTemplates}
                    isEditing={!!editingPlan}
                    showSetupFee={true}
                    showPaidMediaAddOn={true}
                  />

                  {/* Stripe Notice */}
                  {!editingPlan && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Zap className="w-4 h-4 text-primary" />
                      <p className="text-sm text-primary">
                        Stripe product & pricing will be created automatically
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPlanPending || isCreatingStripe}
                  >
                    {(isPlanPending || isCreatingStripe) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingPlan ? 'Update Plan' : 'Create Plan'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoadingPlans ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No plans yet. Add a plan to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Plan</TableHead>
                    <TableHead className="min-w-[100px]">Price</TableHead>
                    <TableHead className="min-w-[120px]">Category</TableHead>
                    <TableHead className="min-w-[90px]">Setup Fee</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[90px]">Stripe</TableHead>
                    <TableHead className="min-w-[90px]">Paid Media</TableHead>
                    <TableHead className="min-w-[120px]">Existing Customer</TableHead>
                    <TableHead className="min-w-[120px]">Contract</TableHead>
                    <TableHead className="min-w-[90px]">Created</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans?.map((plan, index) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p
                            className="text-xs text-muted-foreground line-clamp-1"
                            dangerouslySetInnerHTML={{
                              __html: plan.description.replace(/<[^>]*>/g, ' ').substring(0, 50)
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        ${Number(plan.monthly_price).toFixed(2)}/mo
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{plan.category ?? 'Other'}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {plan.setup_fee ? `$${Number(plan.setup_fee).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {plan.stripe_price_id ? (
                          <Badge variant="default" className="gap-1">
                            <Zap className="w-3 h-3" />
                            Connected
                          </Badge>
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
                        {plan.existing_customer_logic ? (
                          <Badge variant="default">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Off</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {plan.contract_templates?.name ? (
                          <Badge variant="outline" className="truncate max-w-[100px]">
                            {plan.contract_templates.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(plan.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => reorderPlanMutation.mutate({ plan, direction: 'up' })}
                            disabled={index === 0 || reorderPlanMutation.isPending}
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => reorderPlanMutation.mutate({ plan, direction: 'down' })}
                            disabled={index === (plans?.length ?? 0) - 1 || reorderPlanMutation.isPending}
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPlan(plan)}
                            title="Edit plan"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => recreateStripePricingMutation.mutate(plan)}
                            disabled={isCreatingStripe}
                            title="Recreate Stripe pricing"
                          >
                            <RefreshCw className={`w-4 h-4 ${isCreatingStripe ? 'animate-spin' : ''}`} />
                          </Button>
                          <ConfirmDeleteDialog
                            title="Delete Plan"
                            description={`Are you sure you want to delete "${plan.name}"? This action cannot be undone.`}
                            onConfirm={() => deletePlanMutation.mutate(plan.id)}
                            isLoading={deletePlanMutation.isPending}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
