import type { Tables } from '@/integrations/supabase/types';

// Base brand type from database
export type Brand = Tables<'brands'>;

// Extended brand with portal and plans
export interface BrandWithRelations extends Brand {
  portals?: {
    id: string;
    name: string;
    subdomain: string;
  };
  plans?: Array<{
    id: string;
    name: string;
    monthly_price: number;
    description: string;
    supports_paid_media: boolean;
    status: string | null;
  }>;
}
