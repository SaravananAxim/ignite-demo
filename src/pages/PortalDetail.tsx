import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PORTAL } from '@/constants';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Plus, Pencil, Globe, Loader2, ExternalLink, FlaskConical, Building2, ChevronRight, Webhook, Save, Calendar } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { format } from 'date-fns';

interface Portal {
  id: string;
  subdomain: string;
  name: string;
  require_payment: boolean;
  created_at: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  effective_date_min: string | null;
  effective_date_option_count: number | null;
}

interface Brand {
  id: string;
  portal_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  existing_customer_logic: boolean;
  created_at: string;
}

export default function PortalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Brand form state
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandFormData, setBrandFormData] = useState({
    name: '',
    logo_url: '',
    primary_color: '#3B82F6',
    accent_color: '#10B981',
    existing_customer_logic: false,
  });

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Effective date settings state
  const [effectiveDateMin, setEffectiveDateMin] = useState('');
  const [effectiveDateOptionCount, setEffectiveDateOptionCount] = useState<string>('');

  // Fetch portal details
  const { data: portal, isLoading: isLoadingPortal } = useQuery({
    queryKey: ['portal', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('portals')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Portal;
    },
    enabled: !!id,
  });

  // Fetch brands for this portal with plan counts
  const { data: brands, isLoading: isLoadingBrands } = useQuery({
    queryKey: ['portal-brands', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('brands')
        .select('*, plans(count)')
        .eq('portal_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (Brand & { plans: { count: number }[] })[];
    },
    enabled: !!id,
  });

  // Sync webhook state with portal data
  useState(() => {
    if (portal) {
      setWebhookUrl(portal.webhook_url || '');
      setWebhookSecret(portal.webhook_secret || '');
    }
  });

  // Effect to update webhook and effective-date state when portal loads
  const [webhookInitialized, setWebhookInitialized] = useState(false);
  if (portal && !webhookInitialized) {
    setWebhookUrl(portal.webhook_url || '');
    setWebhookSecret(portal.webhook_secret || '');
    setEffectiveDateMin(portal.effective_date_min || '');
    setEffectiveDateOptionCount(
      portal.effective_date_option_count != null ? String(portal.effective_date_option_count) : '' // '' = 6 (default)
    );
    setWebhookInitialized(true);
  }

  // Effective date settings mutation
  const updateEffectiveDateMutation = useMutation({
    mutationFn: async ({ minDate, optionCount }: { minDate: string; optionCount: string }) => {
      const { error } = await supabase
        .from('portals')
        .update({
          effective_date_min: minDate || null,
          effective_date_option_count: optionCount === '' ? null : (optionCount === '0' ? 0 : Math.max(1, parseInt(optionCount, 10))),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', id] });
      toast.success('Signup date options saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Webhook update mutation
  const updateWebhookMutation = useMutation({
    mutationFn: async ({ url, secret }: { url: string; secret: string }) => {
      const { error } = await supabase
        .from('portals')
        .update({
          webhook_url: url || null,
          webhook_secret: secret || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', id] });
      toast.success('Webhook settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Brand mutations
  const createBrandMutation = useMutation({
    mutationFn: async (data: typeof brandFormData) => {
      const { error } = await supabase.from('brands').insert([{
        portal_id: id,
        name: data.name,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        existing_customer_logic: data.existing_customer_logic,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-brands', id] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      toast.success('Brand created successfully');
      resetBrandForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateBrandMutation = useMutation({
    mutationFn: async ({ brandId, data }: { brandId: string; data: typeof brandFormData }) => {
      const { error } = await supabase.from('brands').update({
        name: data.name,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        existing_customer_logic: data.existing_customer_logic,
      }).eq('id', brandId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-brands', id] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      toast.success('Brand updated successfully');
      resetBrandForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', brandId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-brands', id] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      toast.success('Brand deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetBrandForm = () => {
    setBrandFormData({ name: '', logo_url: '', primary_color: '#3B82F6', accent_color: '#10B981', existing_customer_logic: false });
    setEditingBrand(null);
    setIsBrandDialogOpen(false);
  };

  const handleEditBrand = (brand: Brand, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBrand(brand);
    setBrandFormData({
      name: brand.name,
      logo_url: brand.logo_url || '',
      primary_color: brand.primary_color || '#3B82F6',
      accent_color: brand.accent_color || '#10B981',
      existing_customer_logic: brand.existing_customer_logic ?? false,
    });
    setIsBrandDialogOpen(true);
  };

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBrand) {
      updateBrandMutation.mutate({ brandId: editingBrand.id, data: brandFormData });
    } else {
      createBrandMutation.mutate(brandFormData);
    }
  };

  const isBrandPending = createBrandMutation.isPending || updateBrandMutation.isPending;

  if (isLoadingPortal) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!portal) {
    return (
      <AdminLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Portal not found</p>
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
              <BreadcrumbPage>{portal.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">{portal.name}</h1>
                <p className="text-muted-foreground font-mono text-sm">{portal.subdomain}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Badge variant={portal.require_payment ? 'default' : 'secondary'}>
                {portal.require_payment ? 'Payment Required' : 'No Payment'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Created {portal.created_at ? format(new Date(portal.created_at), 'MMM d, yyyy') : 'Unknown'}
              </span>
            </div>
          </div>

          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const testUrl = `${window.location.origin}/select-brand?portal=${portal.subdomain}`;
                      window.open(testUrl, '_blank');
                    }}
                  >
                    <FlaskConical className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Test with ?portal= param</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const liveUrl = PORTAL.getPortalUrl(portal.subdomain);
                      window.open(liveUrl, '_blank');
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Live
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open {portal.subdomain}.{PORTAL.BASE_DOMAIN}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Signup date options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Signup date options
            </CardTitle>
            <CardDescription>
              Control which effective dates franchisees can choose (e.g. open the portal in advance or limit to first few options).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="effective-date-min">Earliest date (optional)</Label>
              <Input
                id="effective-date-min"
                type="date"
                value={effectiveDateMin}
                onChange={(e) => setEffectiveDateMin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only show dates on or after this day. Leave empty to use the default (5 days from today).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-date-count">Number of options to show</Label>
              <Input
                id="effective-date-count"
                type="number"
                min={0}
                placeholder="6"
                value={effectiveDateOptionCount}
                onChange={(e) => setEffectiveDateOptionCount(e.target.value)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Default is 6. Use 0 to show every available date option.
              </p>
            </div>
            <Button
              onClick={() => updateEffectiveDateMutation.mutate({ minDate: effectiveDateMin, optionCount: effectiveDateOptionCount })}
              disabled={updateEffectiveDateMutation.isPending}
              className="gap-2"
            >
              {updateEffectiveDateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save signup date options
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Settings Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Webhook Settings
            </CardTitle>
            <CardDescription>
              Receive notifications at key points in the signup process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Events Info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Webhook Events</p>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="shrink-0 mt-0.5">1</Badge>
                  <div>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">signup.ready_for_countersign</code>
                    <p className="text-muted-foreground text-xs mt-1">
                      Triggered when a franchisee signs the contract and it's awaiting admin counter-signature
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="shrink-0 mt-0.5">2</Badge>
                  <div>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">signup.completed</code>
                    <p className="text-muted-foreground text-xs mt-1">
                      Triggered when admin counter-signs and the signup is fully complete
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                POST requests will be sent to this URL with full signup, contract, and franchisee details
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook Secret (optional)</Label>
              <Input
                id="webhook-secret"
                type="password"
                placeholder="Enter a secret key for signature verification"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If set, requests include <code className="text-xs bg-muted px-1 rounded">X-Webhook-Signature</code> header with HMAC-SHA256 signature
              </p>
            </div>
            <Button
              onClick={() => updateWebhookMutation.mutate({ url: webhookUrl, secret: webhookSecret })}
              disabled={updateWebhookMutation.isPending}
              className="gap-2"
            >
              {updateWebhookMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Webhook Settings
            </Button>
          </CardContent>
        </Card>

        {/* Brands Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Brands
              </CardTitle>
              <CardDescription>
                {brands?.length || 0} brand{brands?.length !== 1 ? 's' : ''} in this portal
              </CardDescription>
            </div>
            <Dialog open={isBrandDialogOpen} onOpenChange={(open) => {
              setIsBrandDialogOpen(open);
              if (!open) resetBrandForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Brand
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBrandSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Brand Name</Label>
                    <Input
                      id="brand-name"
                      placeholder="My Brand"
                      value={brandFormData.name}
                      onChange={(e) => setBrandFormData({ ...brandFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo-url">Logo URL (optional)</Label>
                    <Input
                      id="logo-url"
                      placeholder="https://example.com/logo.png"
                      value={brandFormData.logo_url}
                      onChange={(e) => setBrandFormData({ ...brandFormData, logo_url: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary-color"
                          type="color"
                          value={brandFormData.primary_color}
                          onChange={(e) => setBrandFormData({ ...brandFormData, primary_color: e.target.value })}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandFormData.primary_color}
                          onChange={(e) => setBrandFormData({ ...brandFormData, primary_color: e.target.value })}
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
                          value={brandFormData.accent_color}
                          onChange={(e) => setBrandFormData({ ...brandFormData, accent_color: e.target.value })}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandFormData.accent_color}
                          onChange={(e) => setBrandFormData({ ...brandFormData, accent_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <Label htmlFor="brand-existing-customer-logic" className="cursor-pointer">Existing Customer Logic</Label>
                      <p className="text-xs text-muted-foreground">Ask customers whether they are new or existing on this brand's plan selection page.</p>
                    </div>
                    <Switch
                      id="brand-existing-customer-logic"
                      checked={brandFormData.existing_customer_logic}
                      onCheckedChange={(checked) => setBrandFormData({ ...brandFormData, existing_customer_logic: checked })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isBrandPending}>
                    {isBrandPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingBrand ? 'Update Brand' : 'Create Brand'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoadingBrands ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : brands?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No brands yet. Add a brand to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Colors</TableHead>
                    <TableHead>Plans</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands?.map((brand) => {
                    const planCount = brand.plans?.[0]?.count || 0;
                    return (
                      <TableRow
                        key={brand.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/portals/${id}/brands/${brand.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={brand.logo_url || undefined} />
                              <AvatarFallback
                                className="text-sm font-medium"
                                style={{ backgroundColor: brand.primary_color || undefined }}
                              >
                                {brand.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{brand.name}</span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full border"
                              style={{ backgroundColor: brand.primary_color || '#3B82F6' }}
                            />
                            <div
                              className="w-5 h-5 rounded-full border"
                              style={{ backgroundColor: brand.accent_color || '#10B981' }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {planCount} plan{planCount !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {brand.created_at ? format(new Date(brand.created_at), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEditBrand(brand, e)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <ConfirmDeleteDialog
                              title="Delete Brand"
                              description={`Are you sure you want to delete "${brand.name}"? This will also delete all plans under this brand. This action cannot be undone.`}
                              onConfirm={() => deleteBrandMutation.mutate(brand.id)}
                              isLoading={deleteBrandMutation.isPending}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}