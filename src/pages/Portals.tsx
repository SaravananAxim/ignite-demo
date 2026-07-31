import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PORTAL } from '@/constants';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Globe, Loader2, ExternalLink, FlaskConical, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { activityLogger } from '@/lib/activityLogger';

interface Portal {
  id: string;
  subdomain: string;
  name: string;
  require_payment: boolean;
  created_at: string;
}

export default function Portals() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [formData, setFormData] = useState({
    subdomain: '',
    name: '',
    require_payment: true,
  });
  const queryClient = useQueryClient();

  const { data: portals, isLoading } = useQuery({
    queryKey: ['portals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Portal[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: created, error } = await supabase
        .from('portals')
        .insert([data])
        .select('id, name, subdomain')
        .single();
      if (error) throw error;

      return created;
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ['portals'] });
      queryClient.invalidateQueries({ queryKey: ['portals-list'] });
      queryClient.invalidateQueries({ queryKey: ['portals-count'] });
      if (created) {
        await activityLogger.portalCreated(created.id, {
          name: created.name,
          subdomain: created.subdomain,
        });
      }
      toast.success('Portal created successfully');
      resetForm();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This subdomain is already taken');
      } else {
        toast.error(error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: updated, error } = await supabase
        .from('portals')
        .update(data)
        .eq('id', id)
        .select('id, name, subdomain')
        .single();
      if (error) throw error;

      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.invalidateQueries({ queryKey: ['portals'] });
      queryClient.invalidateQueries({ queryKey: ['portals-list'] });
      queryClient.invalidateQueries({ queryKey: ['portals-count'] });
      if (updated) {
        await activityLogger.portalUpdated(updated.id, {
          name: updated.name,
          subdomain: updated.subdomain,
        });
      }
      toast.success('Portal updated successfully');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portals').delete().eq('id', id);
      if (error) throw error;

      return id;
    },
    onSuccess: async (id) => {
      queryClient.invalidateQueries({ queryKey: ['portals'] });
      queryClient.invalidateQueries({ queryKey: ['portals-list'] });
      queryClient.invalidateQueries({ queryKey: ['portals-count'] });
      await activityLogger.portalDeleted(id, {});
      toast.success('Portal deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ subdomain: '', name: '', require_payment: true });
    setEditingPortal(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (portal: Portal) => {
    setEditingPortal(portal);
    setFormData({
      subdomain: portal.subdomain,
      name: portal.name,
      require_payment: portal.require_payment,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPortal) {
      updateMutation.mutate({ id: editingPortal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Portals</h1>
            <p className="text-muted-foreground mt-1">
              Manage your subdomain portals
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Add Portal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPortal ? 'Edit Portal' : 'Create Portal'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <Input
                    id="subdomain"
                    placeholder="my-portal"
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Portal Name</Label>
                  <Input
                    id="name"
                    placeholder="My Portal"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="require_payment">Require Payment</Label>
                  <Switch
                    id="require_payment"
                    checked={formData.require_payment}
                    onCheckedChange={(checked) => setFormData({ ...formData, require_payment: checked })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingPortal ? 'Update Portal' : 'Create Portal'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5" />
              All Portals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : portals?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No portals yet. Create your first portal to get started.
              </div>
            ) : (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Payment Required</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portals?.map((portal) => (
                    <TableRow 
                      key={portal.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/portals/${portal.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {portal.subdomain}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{portal.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={portal.require_payment ? 'default' : 'secondary'}>
                          {portal.require_payment ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {format(new Date(portal.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    const testUrl = `${window.location.origin}/select-brand?portal=${portal.subdomain}`;
                                    window.open(testUrl, '_blank');
                                  }}
                                >
                                  <FlaskConical className="w-3.5 h-3.5" />
                                  Test
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Open with ?portal= param (internal testing)</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    const liveUrl = PORTAL.getPortalUrl(portal.id);
                                    window.open(liveUrl, '_blank');
                                  }}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Live
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Open actual portal (app-signup-qa.{PORTAL.BASE_DOMAIN}/onboarding/{portal.id})</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(portal)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <ConfirmDeleteDialog
                            title="Delete Portal"
                            description={`Are you sure you want to delete "${portal.name}"? This will also delete all brands and plans under this portal. This action cannot be undone.`}
                            onConfirm={() => deleteMutation.mutate(portal.id)}
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
