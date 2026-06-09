import { supabase } from '@/integrations/supabase/client';
import type { Brand, BrandWithRelations } from '@/types/brand';

export const brandService = {
  /**
   * Get a brand by ID with relations
   */
  async getById(id: string): Promise<BrandWithRelations | null> {
    const { data, error } = await supabase
      .from('brands')
      .select('*, portals:portal_id(*), plans(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get brands by portal ID
   */
  async getByPortalId(portalId: string): Promise<Brand[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('portal_id', portalId)
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get all brands with portal info
   */
  async getAll(): Promise<BrandWithRelations[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*, portals:portal_id(*)')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new brand
   */
  async create(params: {
    name: string;
    portalId: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    domainPattern?: string;
  }): Promise<Brand> {
    const { data, error } = await supabase
      .from('brands')
      .insert({
        name: params.name,
        portal_id: params.portalId,
        logo_url: params.logoUrl,
        primary_color: params.primaryColor,
        accent_color: params.accentColor,
        domain_pattern: params.domainPattern,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a brand
   */
  async update(id: string, params: Partial<{
    name: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    domainPattern: string;
  }>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.logoUrl !== undefined) updateData.logo_url = params.logoUrl;
    if (params.primaryColor !== undefined) updateData.primary_color = params.primaryColor;
    if (params.accentColor !== undefined) updateData.accent_color = params.accentColor;
    if (params.domainPattern !== undefined) updateData.domain_pattern = params.domainPattern;

    const { error } = await supabase
      .from('brands')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Delete a brand
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
