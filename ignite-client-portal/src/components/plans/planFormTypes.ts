export const PLAN_CATEGORIES = ['Earned Media', 'Paid Media', 'AI', 'Other'] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export interface PlanFormData {
  name: string;
  description: string;
  monthly_price: string;
  setup_fee: string;
  monthly_price_with_media: string;
  supports_paid_media: boolean;
  requires_paid_media: boolean;
  category: PlanCategory;
  contract_template_id: string;
  status: string;
}
