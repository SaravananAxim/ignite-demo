import type { Tables } from '@/integrations/supabase/types';

// Base franchisee type from database
export type Franchisee = Tables<'franchisees'>;

// Extended franchisee with related data
export interface FranchiseeWithRelations extends Franchisee {
  brands?: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
  } | null;
  plans?: {
    id: string;
    name: string;
    monthly_price: number;
    description: string;
    supports_paid_media: boolean;
  } | null;
}

// Location details stored in JSON
export interface LocationDetails {
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  firstName?: string;
  lastName?: string;
  additionalNotes?: string;
}

// Franchisee statuses - reflects full onboarding journey
export const FRANCHISEE_STATUS = {
  PENDING: 'pending',                         // Initial submission, awaiting payment
  PAYMENT_COMPLETED: 'payment_completed',     // Payment authorized/processed
  CONTRACT_SIGNED: 'contract_signed',         // Franchisee has signed contract
  AWAITING_COUNTERSIGN: 'awaiting_countersign', // Waiting for admin counter-signature
  COMPLETED: 'completed',                     // Fully onboarded and active
  ACTIVE: 'active',                           // Active customer (legacy/alias for completed)
  INACTIVE: 'inactive',                       // Account temporarily inactive
  CANCELLED: 'cancelled',                     // Account cancelled
} as const;

export type FranchiseeStatus = typeof FRANCHISEE_STATUS[keyof typeof FRANCHISEE_STATUS];

// Payment statuses
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// Onboarding step tracking
export const ONBOARDING_STEP = {
  PAYMENT: 'payment',
  INTAKE: 'intake',
  REPRESENTATIVES: 'representatives',
  CONTRACT: 'contract',
  COMPLETE: 'complete',
} as const;

export type OnboardingStep = typeof ONBOARDING_STEP[keyof typeof ONBOARDING_STEP];

// Form data for intake (step 1 of onboarding form)
export interface IntakeFormData {
  [key: string]: unknown;
  // Business Information
  businessName: string;
  legalBusinessName: string;
  legalEntity: string;
  
  // Signer Information
  firstName: string;
  lastName: string;
  email: string;
  positionTitle: string;
  businessPhone: string;
  cellPhone: string;
  
  // Location Information
  franchiseLocationName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  isNewLocation: boolean;
  grandOpeningDate: string;
  
  // Additional
  additionalNotes: string;
  paidMediaBudget: string;
}

// Form data for representatives (step 2 of onboarding form)
export interface RepresentativesFormData {
  [key: string]: unknown;
  // Campaign Representative
  campaignRepName: string;
  campaignRepEmail: string;
  campaignRepPhone: string;
  signerIsCampaignRep: boolean;
  
  // Billing Representative
  billingRepName: string;
  billingRepEmail: string;
  billingRepPhone: string;
  signerIsBillingRep: boolean;
}

// Initial form data
export const INITIAL_INTAKE_DATA: IntakeFormData = {
  businessName: '',
  legalBusinessName: '',
  legalEntity: '',
  firstName: '',
  lastName: '',
  email: '',
  positionTitle: '',
  businessPhone: '',
  cellPhone: '',
  franchiseLocationName: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  isNewLocation: false,
  grandOpeningDate: '',
  additionalNotes: '',
  paidMediaBudget: '',
};

export const INITIAL_REPRESENTATIVES_DATA: RepresentativesFormData = {
  campaignRepName: '',
  campaignRepEmail: '',
  campaignRepPhone: '',
  signerIsCampaignRep: false,
  billingRepName: '',
  billingRepEmail: '',
  billingRepPhone: '',
  signerIsBillingRep: false,
};
