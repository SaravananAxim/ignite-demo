import type { Tables } from '@/integrations/supabase/types';

// Base plan type from database
export type Plan = Tables<'plans'>;

// Extended plan with brand info
export interface PlanWithBrand extends Plan {
  brands?: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    portal_id: string;
  };
}

// Plan status
export const PLAN_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];

// Pricing tiers
export const PRICING_TIERS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type PricingTier = typeof PRICING_TIERS[keyof typeof PRICING_TIERS];
