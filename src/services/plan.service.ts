import { supabase } from '@/integrations/supabase/client';
import type { Plan, PlanWithBrand } from '@/types/plan';

export const planService = {
  /**
   * Get a plan by ID with brand info
   */
  async getById(id: string): Promise<PlanWithBrand | null> {
    const { data, error } = await supabase
      .from('plans')
      .select('*, brands(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get plans by brand ID
   */
  async getByBrandId(brandId: string): Promise<Plan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('brand_id', brandId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get active plans by brand ID
   */
  async getActiveByBrandId(brandId: string): Promise<Plan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get all plans with brand info
   */
  async getAll(): Promise<PlanWithBrand[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*, brands(*)')
      .order('brand_id', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new plan
   */
  async create(params: {
    name: string;
    description: string;
    brandId: string;
    monthlyPrice: number;
    stripePaymentLink: string;
    supportsPaidMedia?: boolean;
    stripePaymentLinkWithMedia?: string;
    setupFee?: number;
    trialDays?: number;
    billingAnchorDay?: number;
    pricingTier?: string;
  }): Promise<Plan> {
    const { data, error } = await supabase
      .from('plans')
      .insert({
        name: params.name,
        description: params.description,
        brand_id: params.brandId,
        monthly_price: params.monthlyPrice,
        stripe_payment_link: params.stripePaymentLink,
        supports_paid_media: params.supportsPaidMedia ?? false,
        stripe_payment_link_with_media: params.stripePaymentLinkWithMedia,
        setup_fee: params.setupFee,
        trial_days: params.trialDays,
        billing_anchor_day: params.billingAnchorDay,
        pricing_tier: params.pricingTier,
        status: 'active',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a plan
   */
  async update(id: string, params: Partial<{
    name: string;
    description: string;
    monthlyPrice: number;
    stripePaymentLink: string;
    supportsPaidMedia: boolean;
    stripePaymentLinkWithMedia: string;
    setupFee: number;
    trialDays: number;
    billingAnchorDay: number;
    pricingTier: string;
    status: string;
  }>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.monthlyPrice !== undefined) updateData.monthly_price = params.monthlyPrice;
    if (params.stripePaymentLink !== undefined) updateData.stripe_payment_link = params.stripePaymentLink;
    if (params.supportsPaidMedia !== undefined) updateData.supports_paid_media = params.supportsPaidMedia;
    if (params.stripePaymentLinkWithMedia !== undefined) updateData.stripe_payment_link_with_media = params.stripePaymentLinkWithMedia;
    if (params.setupFee !== undefined) updateData.setup_fee = params.setupFee;
    if (params.trialDays !== undefined) updateData.trial_days = params.trialDays;
    if (params.billingAnchorDay !== undefined) updateData.billing_anchor_day = params.billingAnchorDay;
    if (params.pricingTier !== undefined) updateData.pricing_tier = params.pricingTier;
    if (params.status !== undefined) updateData.status = params.status;

    const { error } = await supabase
      .from('plans')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Delete a plan
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
