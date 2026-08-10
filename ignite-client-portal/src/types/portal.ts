import type { Tables } from '@/integrations/supabase/types';

// Base portal type from database
export type Portal = Tables<'portals'>;

// Portal context type used in app
export interface PortalContext {
  portal_id: string;
  portal_name: string;
  require_payment: boolean;
  subdomain: string;
  contract_only_mode?: boolean;
}

// Extended portal with brands
export interface PortalWithBrands extends Portal {
  brands?: Array<{
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
  }>;
}
