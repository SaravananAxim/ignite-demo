import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Building2, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { format } from 'date-fns';
import { activityLogger } from '@/lib/activityLogger';

interface Brand {
  id: string;
  portal_id: string;
  name: string;
  logo_url: string | null;
  existing_customer_logic: boolean;
  created_at: string;
  portals?: { name: string };
}

interface Portal {
  id: string;
  name: string;
}

export default function Brands() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    portal_id: '',
    name: '',
    logo_url: '',
    existing_customer_logic: false,
  });
  const queryClient = useQueryClient();

  const { data: portals } = useQuery({
    queryKey: ['portals-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portals').select('id, name');
      if (error) throw error;
      return data as Portal[];
    },
  });

  const { data: brands, isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*, portals(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Brand[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { portal_id: string; name: string; logo_url: string | null; existing_customer_logic: boolean }) => {
      const { data: created, error } = await supabase.from('brands').insert([{
        ...data,
        logo_url: data.logo_url || null
      }]).select('id, name').single();
      if (error) throw error;
      return created;
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands-count'] });
      queryClient.invalidateQueries({ queryKey: ['brands-filter'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      if (created) {
        await activityLogger.logActivity('brand_created', 'brand', created.id, { name: created.name });
      }
      toast.success('Brand created successfully');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { portal_id: string; name: string; logo_url: string | null; existing_customer_logic: boolean } }) => {
      const { data: updated, error } = await supabase.from('brands').update({
        ...data,
        logo_url: data.logo_url || null
      }).eq('id', id).select('id, name').single();
      if (error) throw error;
      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands-count'] });
      queryClient.invalidateQueries({ queryKey: ['brands-filter'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      if (updated) {
        await activityLogger.logActivity('brand_updated', 'brand', updated.id, { name: updated.name });
      }
      toast.success('Brand updated successfully');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-list'] });
      queryClient.invalidateQueries({ queryKey: ['brands-management'] });
      queryClient.invalidateQueries({ queryKey: ['brands-count'] });
      queryClient.invalidateQueries({ queryKey: ['brands-filter'] });
      queryClient.invalidateQueries({ queryKey: ['portal-brands'] });
      await activityLogger.logActivity('brand_deleted', 'brand', id, {});
      toast.success('Brand deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ portal_id: '', name: '', logo_url: '', existing_customer_logic: false });
    setEditingBrand(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      portal_id: brand.portal_id,
      name: brand.name,
      logo_url: brand.logo_url || '',
      existing_customer_logic: brand.existing_customer_logic ?? false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      portal_id: formData.portal_id,
      name: formData.name,
      logo_url: formData.logo_url || null,
      existing_customer_logic: formData.existing_customer_logic,
    };
    if (editingBrand) {
      updateMutation.mutate({ id: editingBrand.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Brands</h1>
            <p className="text-muted-foreground mt-1">
              Manage brands within your portals
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Add Brand
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBrand ? 'Edit Brand' : 'Create Brand'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="portal">Portal</Label>
                  <Select
                    value={formData.portal_id}
                    onValueChange={(value) => setFormData({ ...formData, portal_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a portal" />
                    </SelectTrigger>
                    <SelectContent>
                      {portals?.map((portal) => (
                        <SelectItem key={portal.id} value={portal.id}>
                          {portal.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Brand Name</Label>
                  <Input
                    id="name"
                    placeholder="My Brand"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL (optional)</Label>
                  <Input
                    id="logo_url"
                    placeholder="https://example.com/logo.png"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <Label htmlFor="existing_customer_logic" className="cursor-pointer">Existing Customer Logic</Label>
                    <p className="text-xs text-muted-foreground">Ask customers whether they are new or existing on this brand's plan selection page.</p>
                  </div>
                  <Switch
                    id="existing_customer_logic"
                    checked={formData.existing_customer_logic}
                    onCheckedChange={(checked) => setFormData({ ...formData, existing_customer_logic: checked })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending || !formData.portal_id}>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingBrand ? 'Update Brand' : 'Create Brand'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              All Brands
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : brands?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No brands yet. Create your first brand to get started.
              </div>
            ) : (
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands?.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={brand.logo_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {brand.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{brand.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {brand.portals?.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {format(new Date(brand.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(brand)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <ConfirmDeleteDialog
                            title="Delete Brand"
                            description={`Are you sure you want to delete "${brand.name}"? This will also delete all plans under this brand. This action cannot be undone.`}
                            onConfirm={() => deleteMutation.mutate(brand.id)}
                            isLoading={deleteMutation.isPending}
                          />
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
    </AdminLayout>
  );
}
