export interface Sku {
  id: string;
  sf_id: string | null;
  source_family: string | null;
  source_product: string;
  product_code: string | null;
  billing_type: string | null;
  std_list_price: number | null;
  price_range: string | null;
  mapped_product_line: string | null;
  mapped_product_id: string | null;
  mapped_category: string | null;
  recommended_action: string | null;
  status: 'active' | 'archived' | 'review';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const SKU_STATUSES = ['active', 'review', 'archived'] as const;
export type SkuStatus = typeof SKU_STATUSES[number];

export const SKU_CATEGORIES = [
  'Organic Search & Local Visibility',
  'Paid Media',
  'Social & Content',
  'Website & Conversion',
  'Analytics & Profitability',
  'Reputation & Trust',
  'Other / Legacy / Admin',
] as const;
