import { supabase } from '@/integrations/supabase/client';
import type { Portal, PortalWithBrands, PortalContext } from '@/types/portal';

export const portalService = {
  /**
   * Get a portal by subdomain
   */
  async getBySubdomain(subdomain: string): Promise<PortalContext | null> {
    const { data, error } = await supabase
      .from('portals')
      .select('id, name, require_payment, subdomain, contract_only_mode')
      .eq('subdomain', subdomain)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      portal_id: data.id,
      portal_name: data.name,
      require_payment: data.require_payment,
      subdomain: data.subdomain,
      contract_only_mode: data.contract_only_mode ?? false,
    };
  },

  /**
   * Get a portal by ID with brands
   */
  async getById(id: string): Promise<PortalWithBrands | null> {
    const { data, error } = await supabase
      .from('portals')
      .select('*, brands(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get all portals
   */
  async getAll(): Promise<Portal[]> {
    const { data, error } = await supabase
      .from('portals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new portal
   */
  async create(params: {
    name: string;
    subdomain: string;
    requirePayment?: boolean;
    contractOnlyMode?: boolean;
  }): Promise<Portal> {
    const { data, error } = await supabase
      .from('portals')
      .insert({
        name: params.name,
        subdomain: params.subdomain,
        require_payment: params.requirePayment ?? true,
        contract_only_mode: params.contractOnlyMode ?? false,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a portal
   */
  async update(id: string, params: Partial<{
    name: string;
    subdomain: string;
    requirePayment: boolean;
    contractOnlyMode: boolean;
  }>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.subdomain !== undefined) updateData.subdomain = params.subdomain;
    if (params.requirePayment !== undefined) updateData.require_payment = params.requirePayment;
    if (params.contractOnlyMode !== undefined) updateData.contract_only_mode = params.contractOnlyMode;

    const { error } = await supabase
      .from('portals')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Delete a portal
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('portals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
