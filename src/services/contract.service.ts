import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type ContractTemplate = Tables<'contract_templates'>;
export type GeneratedContract = Tables<'generated_contracts'>;

export interface GeneratedContractWithRelations extends GeneratedContract {
  contract_templates?: ContractTemplate;
}

export const contractService = {
  /**
   * Get the latest contract template
   */
  async getLatestTemplate(): Promise<ContractTemplate | null> {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get a contract template by ID
   */
  async getTemplateById(id: string): Promise<ContractTemplate | null> {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get all contract templates
   */
  async getAllTemplates(): Promise<ContractTemplate[]> {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a contract template
   */
  async createTemplate(params: {
    name: string;
    htmlContent: string;
    placeholders: string[];
    version?: string;
  }): Promise<ContractTemplate> {
    const { data, error } = await supabase
      .from('contract_templates')
      .insert({
        name: params.name,
        html_content: params.htmlContent,
        placeholders: params.placeholders,
        version: params.version || '1.0',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a contract template
   */
  async updateTemplate(id: string, params: Partial<{
    name: string;
    htmlContent: string;
    placeholders: string[];
    version: string;
  }>): Promise<void> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (params.name !== undefined) updateData.name = params.name;
    if (params.htmlContent !== undefined) updateData.html_content = params.htmlContent;
    if (params.placeholders !== undefined) updateData.placeholders = params.placeholders;
    if (params.version !== undefined) updateData.version = params.version;

    const { error } = await supabase
      .from('contract_templates')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Get generated contracts for a franchisee
   */
  async getByFranchiseeId(franchiseeId: string): Promise<GeneratedContractWithRelations[]> {
    const { data, error } = await supabase
      .from('generated_contracts')
      .select('*, contract_templates(*)')
      .eq('franchisee_id', franchiseeId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a generated contract
   */
  async createGeneratedContract(params: {
    franchiseeId: string;
    templateId: string;
    finalHtml: string;
    franchiseeSignature?: string;
    status?: string;
  }): Promise<GeneratedContract> {
    const { data, error } = await supabase
      .from('generated_contracts')
      .insert({
        franchisee_id: params.franchiseeId,
        template_id: params.templateId,
        final_html: params.finalHtml,
        franchisee_signature: params.franchiseeSignature,
        franchisee_signed_at: params.franchiseeSignature ? new Date().toISOString() : null,
        status: params.status || 'draft',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update generated contract with counter signature
   */
  async addCounterSignature(id: string, counterSignature: string): Promise<void> {
    const { error } = await supabase
      .from('generated_contracts')
      .update({
        counter_signature: counterSignature,
        counter_signed_at: new Date().toISOString(),
        status: 'fully_signed',
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Update generated contract status
   */
  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('generated_contracts')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
  },
};
