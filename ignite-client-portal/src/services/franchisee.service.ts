import { supabase } from '@/integrations/supabase/client';
import type { Franchisee, FranchiseeWithRelations, IntakeFormData } from '@/types/franchisee';

export const franchiseeService = {
  /**
   * Get a franchisee by ID with related brand and plan data
   */
  async getById(id: string): Promise<FranchiseeWithRelations | null> {
    const { data, error } = await supabase
      .from('franchisees')
      .select('*, brands(*), plans(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get franchisees by brand ID
   */
  async getByBrandId(brandId: string): Promise<FranchiseeWithRelations[]> {
    const { data, error } = await supabase
      .from('franchisees')
      .select('*, brands(*), plans(*)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get all franchisees with optional filters
   */
  async getAll(filters?: {
    status?: string;
    brandId?: string;
    search?: string;
  }): Promise<FranchiseeWithRelations[]> {
    let query = supabase
      .from('franchisees')
      .select('*, brands(*), plans(*)')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.brandId) {
      query = query.eq('brand_id', filters.brandId);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new franchisee from onboarding data
   */
  async create(params: {
    formData: IntakeFormData;
    brandId: string;
    planId: string;
    includePaidMedia: boolean;
  }): Promise<Franchisee> {
    const { formData, brandId, planId, includePaidMedia } = params;
    
    const { data, error } = await supabase
      .from('franchisees')
      .insert({
        name: formData.businessName,
        email: formData.email,
        phone: formData.businessPhone,
        business_phone: formData.businessPhone,
        cell_phone: formData.cellPhone,
        brand_id: brandId,
        plan_id: planId,
        status: 'pending',
        address: `${formData.streetAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}`,
        include_paid_media: includePaidMedia,
        legal_business_name: formData.legalBusinessName,
        legal_entity: formData.legalEntity,
        position_title: formData.positionTitle,
        franchise_location_name: formData.franchiseLocationName,
        is_new_location: formData.isNewLocation,
        grand_opening_date: formData.grandOpeningDate || null,
        location_details: {
          streetAddress: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          firstName: formData.firstName,
          lastName: formData.lastName,
          additionalNotes: formData.additionalNotes,
        },
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update franchisee status
   */
  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('franchisees')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Update franchisee signature
   */
  async updateSignature(id: string, signatureData: string): Promise<void> {
    const { error } = await supabase
      .from('franchisees')
      .update({
        signature_data: signatureData,
        signature_date: new Date().toISOString(),
        status: 'contract_signed',
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Update franchisee payment info
   */
  async updatePaymentInfo(id: string, params: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    paymentStatus?: string;
    trialEndsAt?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('franchisees')
      .update({
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        payment_status: params.paymentStatus,
        trial_ends_at: params.trialEndsAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Delete a franchisee
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('franchisees')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Bulk update franchisee status
   */
  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    const { error } = await supabase
      .from('franchisees')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids);
    
    if (error) throw error;
  },
};
