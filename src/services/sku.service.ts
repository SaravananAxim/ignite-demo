import { supabase } from '@/integrations/supabase/client';
import type { Sku, SkuStatus } from '@/types/sku';

export const skuService = {
  /**
   * Get all SKUs ordered by source_product
   */
  async getAll(): Promise<Sku[]> {
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .order('source_product', { ascending: true });

    if (error) throw error;
    return (data as Sku[]) || [];
  },

  /**
   * Get a single SKU by ID
   */
  async getById(id: string): Promise<Sku | null> {
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Sku;
  },

  /**
   * Create a new SKU
   */
  async create(params: Partial<Omit<Sku, 'id' | 'created_at' | 'updated_at'>> & { source_product: string }): Promise<Sku> {
    const { data, error } = await supabase
      .from('skus')
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data as Sku;
  },

  /**
   * Update an existing SKU
   */
  async update(id: string, params: Partial<Omit<Sku, 'id' | 'created_at' | 'updated_at'>>): Promise<Sku> {
    const { data, error } = await supabase
      .from('skus')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Sku;
  },

  /**
   * Delete a SKU by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('skus')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Shorthand for toggling active / review / archived
   */
  async updateStatus(id: string, status: SkuStatus): Promise<Sku> {
    const { data, error } = await supabase
      .from('skus')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Sku;
  },
};
