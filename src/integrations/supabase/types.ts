export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string
          target_type: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id: string
          target_type: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string
          target_type?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          accent_color: string | null
          created_at: string
          domain_pattern: string | null
          existing_customer_logic: boolean
          id: string
          logo_url: string | null
          name: string
          portal_id: string
          primary_color: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          domain_pattern?: string | null
          existing_customer_logic?: boolean
          id?: string
          logo_url?: string | null
          name: string
          portal_id: string
          primary_color?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          domain_pattern?: string | null
          existing_customer_logic?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          portal_id?: string
          primary_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          created_at: string
          html_content: string
          id: string
          name: string
          placeholders: string[]
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          created_at?: string
          html_content?: string
          id?: string
          name: string
          placeholders?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          name?: string
          placeholders?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      franchisees: {
        Row: {
          address: string | null
          billing_rep_email: string | null
          billing_rep_name: string | null
          billing_rep_phone: string | null
          brand_id: string | null
          business_phone: string | null
          campaign_rep_email: string | null
          campaign_rep_name: string | null
          campaign_rep_phone: string | null
          cell_phone: string | null
          created_at: string
          customer_type: string
          email: string
          franchise_location_name: string | null
          grand_opening_date: string | null
          id: string
          include_paid_media: boolean | null
          is_new_location: boolean | null
          join_date: string
          legal_business_name: string | null
          legal_entity: string | null
          location_details: Json | null
          name: string
          onboarding_step: string | null
          paid_media_budget: string | null
          payment_status: string | null
          phone: string | null
          plan_id: string | null
          position_title: string | null
          service_start_date: string | null
          signature_data: string | null
          signature_date: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          billing_rep_email?: string | null
          billing_rep_name?: string | null
          billing_rep_phone?: string | null
          brand_id?: string | null
          business_phone?: string | null
          campaign_rep_email?: string | null
          campaign_rep_name?: string | null
          campaign_rep_phone?: string | null
          cell_phone?: string | null
          created_at?: string
          customer_type?: string
          email: string
          franchise_location_name?: string | null
          grand_opening_date?: string | null
          id?: string
          include_paid_media?: boolean | null
          is_new_location?: boolean | null
          join_date?: string
          legal_business_name?: string | null
          legal_entity?: string | null
          location_details?: Json | null
          name: string
          onboarding_step?: string | null
          paid_media_budget?: string | null
          payment_status?: string | null
          phone?: string | null
          plan_id?: string | null
          position_title?: string | null
          service_start_date?: string | null
          signature_data?: string | null
          signature_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          billing_rep_email?: string | null
          billing_rep_name?: string | null
          billing_rep_phone?: string | null
          brand_id?: string | null
          business_phone?: string | null
          campaign_rep_email?: string | null
          campaign_rep_name?: string | null
          campaign_rep_phone?: string | null
          cell_phone?: string | null
          created_at?: string
          customer_type?: string
          email?: string
          franchise_location_name?: string | null
          grand_opening_date?: string | null
          id?: string
          include_paid_media?: boolean | null
          is_new_location?: boolean | null
          join_date?: string
          legal_business_name?: string | null
          legal_entity?: string | null
          location_details?: Json | null
          name?: string
          onboarding_step?: string | null
          paid_media_budget?: string | null
          payment_status?: string | null
          phone?: string | null
          plan_id?: string | null
          position_title?: string | null
          service_start_date?: string | null
          signature_data?: string | null
          signature_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchisees_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchisees_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_contracts: {
        Row: {
          counter_signature: string | null
          counter_signed_at: string | null
          created_at: string
          final_html: string
          franchisee_id: string
          franchisee_signature: string | null
          franchisee_signed_at: string | null
          id: string
          pdf_url: string | null
          signed_pdf_url: string | null
          status: string
          template_id: string
        }
        Insert: {
          counter_signature?: string | null
          counter_signed_at?: string | null
          created_at?: string
          final_html: string
          franchisee_id: string
          franchisee_signature?: string | null
          franchisee_signed_at?: string | null
          id?: string
          pdf_url?: string | null
          signed_pdf_url?: string | null
          status?: string
          template_id: string
        }
        Update: {
          counter_signature?: string | null
          counter_signed_at?: string | null
          created_at?: string
          final_html?: string
          franchisee_id?: string
          franchisee_signature?: string | null
          franchisee_signed_at?: string | null
          id?: string
          pdf_url?: string | null
          signed_pdf_url?: string | null
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_contracts_franchisee_id_fkey"
            columns: ["franchisee_id"]
            isOneToOne: false
            referencedRelation: "franchisees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_anchor_day: number | null
          brand_id: string
          category: string
          contract_template_id: string | null
          created_at: string
          description: string
          display_order: number
          existing_customer_logic: boolean
          features: Json | null
          id: string
          monthly_price: number
          monthly_price_with_media: number | null
          name: string
          pricing_tier: string | null
          requires_paid_media: boolean
          setup_fee: number | null
          status: string | null
          stripe_payment_link: string
          stripe_payment_link_with_media: string | null
          stripe_price_id: string | null
          stripe_price_id_with_media: string | null
          supports_paid_media: boolean
          trial_days: number | null
        }
        Insert: {
          billing_anchor_day?: number | null
          brand_id: string
          category?: string
          contract_template_id?: string | null
          created_at?: string
          description: string
          display_order?: number
          existing_customer_logic?: boolean
          features?: Json | null
          id?: string
          monthly_price: number
          monthly_price_with_media?: number | null
          name: string
          pricing_tier?: string | null
          requires_paid_media?: boolean
          setup_fee?: number | null
          status?: string | null
          stripe_payment_link: string
          stripe_payment_link_with_media?: string | null
          stripe_price_id?: string | null
          stripe_price_id_with_media?: string | null
          supports_paid_media?: boolean
          trial_days?: number | null
        }
        Update: {
          billing_anchor_day?: number | null
          brand_id?: string
          category?: string
          contract_template_id?: string | null
          created_at?: string
          description?: string
          display_order?: number
          existing_customer_logic?: boolean
          features?: Json | null
          id?: string
          monthly_price?: number
          monthly_price_with_media?: number | null
          name?: string
          pricing_tier?: string | null
          requires_paid_media?: boolean
          setup_fee?: number | null
          status?: string | null
          stripe_payment_link?: string
          stripe_payment_link_with_media?: string | null
          stripe_price_id?: string | null
          stripe_price_id_with_media?: string | null
          supports_paid_media?: boolean
          trial_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_contract_template_id_fkey"
            columns: ["contract_template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_skus: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          plan_id: string
          quantity: number | null
          sku_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          plan_id: string
          quantity?: number | null
          sku_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          quantity?: number | null
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_skus_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          billing_type: string | null
          created_at: string
          id: string
          mapped_category: string | null
          mapped_product_id: string | null
          mapped_product_line: string | null
          notes: string | null
          price_range: string | null
          product_code: string | null
          recommended_action: string | null
          sf_id: string | null
          source_family: string | null
          source_product: string
          std_list_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_type?: string | null
          created_at?: string
          id?: string
          mapped_category?: string | null
          mapped_product_id?: string | null
          mapped_product_line?: string | null
          notes?: string | null
          price_range?: string | null
          product_code?: string | null
          recommended_action?: string | null
          sf_id?: string | null
          source_family?: string | null
          source_product: string
          std_list_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_type?: string | null
          created_at?: string
          id?: string
          mapped_category?: string | null
          mapped_product_id?: string | null
          mapped_product_line?: string | null
          notes?: string | null
          price_range?: string | null
          product_code?: string | null
          recommended_action?: string | null
          sf_id?: string | null
          source_family?: string | null
          source_product?: string
          std_list_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portals: {
        Row: {
          contract_only_mode: boolean | null
          created_at: string
          effective_date_min: string | null
          effective_date_option_count: number | null
          id: string
          name: string
          require_payment: boolean
          subdomain: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          contract_only_mode?: boolean | null
          created_at?: string
          effective_date_min?: string | null
          effective_date_option_count?: number | null
          id?: string
          name: string
          require_payment?: boolean
          subdomain: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          contract_only_mode?: boolean | null
          created_at?: string
          effective_date_min?: string | null
          effective_date_option_count?: number | null
          id?: string
          name?: string
          require_payment?: boolean
          subdomain?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt_number: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_name: string
          id: string
          payload: Json
          replay_of_delivery_id: string | null
          request_headers: Json | null
          response_body: string | null
          response_status: number | null
          status: string
          webhook_subscription_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_name: string
          id?: string
          payload: Json
          replay_of_delivery_id?: string | null
          request_headers?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_subscription_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_name?: string
          id?: string
          payload?: Json
          replay_of_delivery_id?: string | null
          request_headers?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_replay_of_delivery_id_fkey"
            columns: ["replay_of_delivery_id"]
            isOneToOne: false
            referencedRelation: "webhook_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_subscription_id_fkey"
            columns: ["webhook_subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_enabled: boolean
          webhook_secret: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_enabled?: boolean
          webhook_secret?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_enabled?: boolean
          webhook_secret?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          billing_type: string | null
          created_at: string
          id: string
          name: string
          plan_id: string | null
          price_monthly: number | null
          price_one_time: number | null
          price_unit: number | null
          primary_pillar: string | null
          product_id: string
          product_line: string | null
          recommended_action: string | null
          representative_skus: string[] | null
          rollup_logic: string | null
          secondary_pillar: string | null
          source_families: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_type?: string | null
          created_at?: string
          id?: string
          name: string
          plan_id?: string | null
          price_monthly?: number | null
          price_one_time?: number | null
          price_unit?: number | null
          primary_pillar?: string | null
          product_id: string
          product_line?: string | null
          recommended_action?: string | null
          representative_skus?: string[] | null
          rollup_logic?: string | null
          secondary_pillar?: string | null
          source_families?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_type?: string | null
          created_at?: string
          id?: string
          name?: string
          plan_id?: string | null
          price_monthly?: number | null
          price_one_time?: number | null
          price_unit?: number | null
          primary_pillar?: string | null
          product_id?: string
          product_line?: string | null
          recommended_action?: string | null
          representative_skus?: string[] | null
          rollup_logic?: string | null
          secondary_pillar?: string | null
          source_families?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          id: string
          included_products: Json | null
          intended_fit: string | null
          monthly_price: number | null
          name: string
          one_time_price: number | null
          package_id: string
          pillar_coverage: string[] | null
          plan_id: string | null
          product_line: string | null
          status: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          included_products?: Json | null
          intended_fit?: string | null
          monthly_price?: number | null
          name: string
          one_time_price?: number | null
          package_id: string
          pillar_coverage?: string[] | null
          plan_id?: string | null
          product_line?: string | null
          status?: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          included_products?: Json | null
          intended_fit?: string | null
          monthly_price?: number | null
          name?: string
          one_time_price?: number | null
          package_id?: string
          pillar_coverage?: string[] | null
          plan_id?: string | null
          product_line?: string | null
          status?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          client_fit: string | null
          convertibility_component: string | null
          created_at: string
          credibility_component: string | null
          id: string
          monthly_price: number | null
          name: string
          one_time_price: number | null
          optional_accelerators: string[] | null
          profitability_component: string | null
          program_id: string
          status: string
          tier: string | null
          updated_at: string
          visibility_component: string | null
        }
        Insert: {
          client_fit?: string | null
          convertibility_component?: string | null
          created_at?: string
          credibility_component?: string | null
          id?: string
          monthly_price?: number | null
          name: string
          one_time_price?: number | null
          optional_accelerators?: string[] | null
          profitability_component?: string | null
          program_id: string
          status?: string
          tier?: string | null
          updated_at?: string
          visibility_component?: string | null
        }
        Update: {
          client_fit?: string | null
          convertibility_component?: string | null
          created_at?: string
          credibility_component?: string | null
          id?: string
          monthly_price?: number | null
          name?: string
          one_time_price?: number | null
          optional_accelerators?: string[] | null
          profitability_component?: string | null
          program_id?: string
          status?: string
          tier?: string | null
          updated_at?: string
          visibility_component?: string | null
        }
        Relationships: []
      }
      product_skus: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number | null
          sku_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number | null
          sku_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number | null
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      package_products: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          package_id: string
          product_id: string
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          package_id: string
          product_id: string
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string
          product_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_products_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      package_skus: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          package_id: string
          quantity: number | null
          sku_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          package_id: string
          quantity?: number | null
          sku_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string
          quantity?: number | null
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_skus_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      program_packages: {
        Row: {
          created_at: string
          id: string
          package_id: string
          program_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          program_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          program_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_packages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "franchisee" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "franchisee", "super_admin"],
    },
  },
} as const
