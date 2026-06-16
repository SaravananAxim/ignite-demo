import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { activityLogger } from '@/lib/activityLogger';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Palette,
  Package,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Brand {
  id: string;
  name: string;
  portal_id: string;
  logo_url: string | null;
  multi_plan_logic: boolean | null;
  domain_pattern: string | null;
  primary_color: string | null;
  accent_color: string | null;
  created_at: string;
  portal?: { name: string };
  plans?: { count: number }[];
}

interface Plan {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  monthly_price: number;
  pricing_tier: string;
  features: PlanFeatures;
  status: string;
  stripe_payment_link: string;
  created_at: string;
  brand?: { name: string };
}

type PlanRow = Omit<Plan, 'features'> & { features: unknown };

interface PlanFeatures {
  custom_domain: boolean;
  ssl: boolean;
  templates: boolean;
  email_campaigns: boolean;
  analytics: boolean;
  api_access: boolean;
  white_label: boolean;
  max_portals: number;
}

const DEFAULT_FEATURES: PlanFeatures = {
  custom_domain: false,
  ssl: true,
  templates: true,
  email_campaigns: false,
  analytics: false,
  api_access: false,
  white_label: false,
  max_portals: 1,
};

const PRICING_TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const TIER_COLORS: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export default function PortalBrandManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Brand dialog state
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState({
    name: '',
    portal_id: '',
    domain_pattern: '',
    logo_url: '',
    multi_plan_logic: false,
    primary_color: '#3B82F6',
    accent_color: '#10B981',
  });
  
  // Plan dialog state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    brand_id: '',
    name: '',
    description: '',
    monthly_price: 0,
    pricing_tier: 'starter',
    stripe_payment_link: '',
    features: { ...DEFAULT_FEATURES },
    status: 'active',
  });
  
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'brand' | 'plan'; id: string; name: string } | null>(null);

  // Fetch portals for brand creation
  const { data: portals } = useQuery({
    queryKey: ['portals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portals')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch brands with portal info and plan count
  const { data: brands, isLoading: brandsLoading } = useQuery({
    queryKey: ['brands-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select(`
          id,
          name,
          portal_id,
          logo_url,
          multi_plan_logic,
          domain_pattern,
          primary_color,
          accent_color,
          created_at,
          portal:portals(name),
          plans(count)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Brand[];
    },
  });

  // Fetch plans with brand info
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select(`
          id,
          brand_id,
          name,
          description,
          monthly_price,
          pricing_tier,
          features,
          status,
          stripe_payment_link,
          created_at,
          brand:brands(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Cast features to PlanFeatures
      return (data as PlanRow[]).map(plan => ({
        ...plan,
        features: (plan.features as PlanFeatures) || { ...DEFAULT_FEATURES },
      })) as Plan[];
    },
  });

  // Brand mutations
  const createBrandMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .insert({
          name: brandForm.name,
          portal_id: brandForm.portal_id,
          domain_pattern: brandForm.domain_pattern || null,
          logo_url: brandForm.logo_url || null,
          multi_plan_logic: brandForm.multi_plan_logic,
          primary_color: brandForm.primary_color,
          accent_color: brandForm.accent_color,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (brand) => {
      await activityLogger.logActivity('brand_created', 'brand', brand.id, { name: brand.name });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      setBrandDialogOpen(false);
      resetBrandForm();
      toast({ title: 'Brand created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create brand', description: error.message, variant: 'destructive' });
    },
  });

  const updateBrandMutation = useMutation({
    mutationFn: async () => {
      if (!editingBrand) return;
      const { data, error } = await supabase
        .from('brands')
        .update({
          name: brandForm.name,
          portal_id: brandForm.portal_id,
          domain_pattern: brandForm.domain_pattern || null,
          logo_url: brandForm.logo_url || null,
          multi_plan_logic: brandForm.multi_plan_logic,
          primary_color: brandForm.primary_color,
          accent_color: brandForm.accent_color,
        })
        .eq('id', editingBrand.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (brand) => {
      if (brand) {
        await activityLogger.logActivity('brand_updated', 'brand', brand.id, { name: brand.name });
      }
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      setBrandDialogOpen(false);
      setEditingBrand(null);
      resetBrandForm();
      toast({ title: 'Brand updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update brand', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await activityLogger.logActivity('brand_deleted', 'brand', id, {});
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      setDeleteTarget(null);
      toast({ title: 'Brand deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete brand', description: error.message, variant: 'destructive' });
    },
  });

  // Plan mutations
  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .insert({
          brand_id: planForm.brand_id,
          name: planForm.name,
          description: planForm.description,
          monthly_price: planForm.monthly_price,
          pricing_tier: planForm.pricing_tier,
          features: planForm.features,
          status: planForm.status,
          stripe_payment_link: planForm.stripe_payment_link,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (plan) => {
      await activityLogger.logActivity('plan_created', 'plan', plan.id, { name: plan.name });
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['brand-plans'] });
      setPlanDialogOpen(false);
      resetPlanForm();
      toast({ title: 'Plan created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create plan', description: error.message, variant: 'destructive' });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlan) return;
      const { data, error } = await supabase
        .from('plans')
        .update({
          brand_id: planForm.brand_id,
          name: planForm.name,
          description: planForm.description,
          monthly_price: planForm.monthly_price,
          pricing_tier: planForm.pricing_tier,
          features: planForm.features,
          status: planForm.status,
          stripe_payment_link: planForm.stripe_payment_link,
        })
        .eq('id', editingPlan.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (plan) => {
      if (plan) {
        await activityLogger.logActivity('plan_updated', 'plan', plan.id, { name: plan.name });
      }
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['brand-plans'] });
      setPlanDialogOpen(false);
      setEditingPlan(null);
      resetPlanForm();
      toast({ title: 'Plan updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update plan', description: error.message, variant: 'destructive' });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await activityLogger.logActivity('plan_deleted', 'plan', id, {});
      queryClient.invalidateQueries({ queryKey: ['plans-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['brand-plans'] });
      setDeleteTarget(null);
      toast({ title: 'Plan deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete plan', description: error.message, variant: 'destructive' });
    },
  });

  // Form helpers
  const resetBrandForm = () => {
    setBrandForm({
      name: '',
      portal_id: '',
      domain_pattern: '',
      logo_url: '',
      multi_plan_logic: false,
      primary_color: '#3B82F6',
      accent_color: '#10B981',
    });
  };

  const resetPlanForm = () => {
    setPlanForm({
      brand_id: '',
      name: '',
      description: '',
      monthly_price: 0,
      pricing_tier: 'starter',
      stripe_payment_link: '',
      features: { ...DEFAULT_FEATURES },
      status: 'active',
    });
  };

  const openEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandForm({
      name: brand.name,
      portal_id: brand.portal_id,
      domain_pattern: brand.domain_pattern || '',
      logo_url: brand.logo_url || '',
      multi_plan_logic: brand.multi_plan_logic === true,
      primary_color: brand.primary_color || '#3B82F6',
      accent_color: brand.accent_color || '#10B981',
    });
    setBrandDialogOpen(true);
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      brand_id: plan.brand_id,
      name: plan.name,
      description: plan.description,
      monthly_price: plan.monthly_price,
      pricing_tier: plan.pricing_tier || 'starter',
      stripe_payment_link: plan.stripe_payment_link,
      features: plan.features || { ...DEFAULT_FEATURES },
      status: plan.status || 'active',
    });
    setPlanDialogOpen(true);
  };

  const handleBrandSubmit = () => {
    if (editingBrand) {
      updateBrandMutation.mutate();
    } else {
      createBrandMutation.mutate();
    }
  };

  const handlePlanSubmit = () => {
    if (editingPlan) {
      updatePlanMutation.mutate();
    } else {
      createPlanMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'brand') {
      deleteBrandMutation.mutate(deleteTarget.id);
    } else {
      deletePlanMutation.mutate(deleteTarget.id);
    }
  };

  const updateFeature = (key: keyof PlanFeatures, value: boolean | number) => {
    setPlanForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 sm:gap-4 min-w-0">
          <Link to="/admin/portal-builder" className="shrink-0">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">Brand & Plan Management</h1>
            <p className="text-muted-foreground mt-1">
              Configure brands and pricing plans for your portals
            </p>
          </div>
        </div>

        {/* Brands Section */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brands
              </CardTitle>
              <CardDescription>
                Manage brand identities and theming
              </CardDescription>
            </div>
            <Button className="w-full shrink-0 sm:w-auto" onClick={() => { resetBrandForm(); setEditingBrand(null); setBrandDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Brand
            </Button>
          </CardHeader>
          <CardContent>
            {brandsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !brands?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No brands created yet. Add your first brand above.
              </div>
            ) : (
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand Name</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Domain Pattern</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead>Plans</TableHead>
                    <TableHead>Plan Selection</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {brand.logo_url && (
                            <img src={brand.logo_url} alt={brand.name} className="h-6 w-6 rounded object-cover" />
                          )}
                          {brand.name}
                        </div>
                      </TableCell>
                      <TableCell>{brand.portal?.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {brand.domain_pattern || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-4 w-4 rounded-full border" 
                            style={{ backgroundColor: brand.primary_color || '#3B82F6' }}
                            title="Primary"
                          />
                          <div 
                            className="h-4 w-4 rounded-full border" 
                            style={{ backgroundColor: brand.accent_color || '#10B981' }}
                            title="Accent"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {brand.plans?.[0]?.count || 0} plans
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={brand.multi_plan_logic ? 'default' : 'outline'}>
                          {brand.multi_plan_logic ? 'Multi-plan' : 'Single plan'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditBrand(brand)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteTarget({ type: 'brand', id: brand.id, name: brand.name })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Plans Section */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Plans
              </CardTitle>
              <CardDescription>
                Configure pricing tiers and features
              </CardDescription>
            </div>
            <Button 
              className="w-full shrink-0 sm:w-auto"
              onClick={() => { resetPlanForm(); setEditingPlan(null); setPlanDialogOpen(true); }}
              disabled={!brands?.length}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Plan
            </Button>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !plans?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No plans created yet. Add your first plan above.
              </div>
            ) : (
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.brand?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={cn(TIER_COLORS[plan.pricing_tier || 'starter'])}>
                          {PRICING_TIERS.find(t => t.value === plan.pricing_tier)?.label || 'Starter'}
                        </Badge>
                      </TableCell>
                      <TableCell>${plan.monthly_price}/mo</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {plan.features?.custom_domain && <Badge variant="outline" className="text-xs">Domain</Badge>}
                          {plan.features?.analytics && <Badge variant="outline" className="text-xs">Analytics</Badge>}
                          {plan.features?.api_access && <Badge variant="outline" className="text-xs">API</Badge>}
                          {plan.features?.white_label && <Badge variant="outline" className="text-xs">White Label</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditPlan(plan)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteTarget({ type: 'plan', id: plan.id, name: plan.name })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Brand Dialog */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add New Brand'}</DialogTitle>
            <DialogDescription>
              Configure brand identity and theming settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name *</Label>
              <Input
                id="brand-name"
                value={brandForm.name}
                onChange={(e) => setBrandForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Acme Franchise"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-portal">Portal *</Label>
              <Select 
                value={brandForm.portal_id} 
                onValueChange={(value) => setBrandForm(prev => ({ ...prev, portal_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a portal" />
                </SelectTrigger>
                <SelectContent>
                  {portals?.map(portal => (
                    <SelectItem key={portal.id} value={portal.id}>{portal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-pattern">Domain Pattern</Label>
              <Input
                id="domain-pattern"
                value={brandForm.domain_pattern}
                onChange={(e) => setBrandForm(prev => ({ ...prev, domain_pattern: e.target.value }))}
                placeholder="e.g., *.acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                value={brandForm.logo_url}
                onChange={(e) => setBrandForm(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <Label htmlFor="multi-plan-logic" className="cursor-pointer text-sm font-medium">
                  Enable multi-plan selection
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, users can select one plan per category during enrollment.
                </p>
              </div>
              <Switch
                id="multi-plan-logic"
                checked={brandForm.multi_plan_logic}
                onCheckedChange={(checked) => setBrandForm(prev => ({ ...prev, multi_plan_logic: checked }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={brandForm.primary_color}
                    onChange={(e) => setBrandForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={brandForm.primary_color}
                    onChange={(e) => setBrandForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={brandForm.accent_color}
                    onChange={(e) => setBrandForm(prev => ({ ...prev, accent_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={brandForm.accent_color}
                    onChange={(e) => setBrandForm(prev => ({ ...prev, accent_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleBrandSubmit}
              disabled={!brandForm.name || !brandForm.portal_id || createBrandMutation.isPending || updateBrandMutation.isPending}
            >
              {(createBrandMutation.isPending || updateBrandMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingBrand ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Add New Plan'}</DialogTitle>
            <DialogDescription>
              Configure pricing tier and features for this plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-brand">Brand *</Label>
              <Select 
                value={planForm.brand_id} 
                onValueChange={(value) => setPlanForm(prev => ({ ...prev, brand_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands?.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name *</Label>
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Pro Plan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricing-tier">Pricing Tier *</Label>
                <Select 
                  value={planForm.pricing_tier} 
                  onValueChange={(value) => setPlanForm(prev => ({ ...prev, pricing_tier: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TIERS.map(tier => (
                      <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-description">Description *</Label>
              <p className="text-xs text-muted-foreground">
                Use bullet points to list what's included in this plan
              </p>
              <RichTextEditor
                value={planForm.description}
                onChange={(value) => setPlanForm(prev => ({ ...prev, description: value }))}
                placeholder="Describe what's included in this plan..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly-price">Monthly Price ($) *</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.monthly_price}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-status">Status</Label>
                <Select 
                  value={planForm.status} 
                  onValueChange={(value) => setPlanForm(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-link">Stripe Payment Link *</Label>
              <Input
                id="stripe-link"
                value={planForm.stripe_payment_link}
                onChange={(e) => setPlanForm(prev => ({ ...prev, stripe_payment_link: e.target.value }))}
                placeholder="https://buy.stripe.com/..."
              />
            </div>
            
            <div className="space-y-3">
              <Label>Features</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'custom_domain', label: 'Custom Domain' },
                  { key: 'ssl', label: 'SSL Certificate' },
                  { key: 'templates', label: 'Templates' },
                  { key: 'email_campaigns', label: 'Email Campaigns' },
                  { key: 'analytics', label: 'Analytics' },
                  { key: 'api_access', label: 'API Access' },
                  { key: 'white_label', label: 'White Label' },
                ].map(feature => (
                  <div key={feature.key} className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={feature.key} className="cursor-pointer text-sm">
                      {feature.label}
                    </Label>
                    <Switch
                      id={feature.key}
                      checked={planForm.features[feature.key as keyof PlanFeatures] as boolean}
                      onCheckedChange={(checked) => updateFeature(feature.key as keyof PlanFeatures, checked)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="max-portals" className="text-sm">Max Portals</Label>
                <Input
                  id="max-portals"
                  type="number"
                  min="1"
                  value={planForm.features.max_portals}
                  onChange={(e) => updateFeature('max_portals', parseInt(e.target.value) || 1)}
                  className="w-20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handlePlanSubmit}
              disabled={
                !planForm.brand_id || 
                !planForm.name || 
                !planForm.description || 
                !planForm.stripe_payment_link ||
                createPlanMutation.isPending || 
                updatePlanMutation.isPending
              }
            >
              {(createPlanMutation.isPending || updatePlanMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingPlan ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
              {deleteTarget?.type === 'brand' && ' All associated plans will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deleteBrandMutation.isPending || deletePlanMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
