export interface ContractTemplate {
  id: string;
  name: string;           // e.g., "Standard Franchise Agreement v2.1"
  version: string;
  htmlContent: string;    // Rich HTML with placeholders
  placeholders: string[]; // ["{{franchiseeName}}", "{{brandName}}", ...]
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;      // admin user ID
}

export interface GeneratedContract {
  id: string;
  franchiseeId: string;
  templateId: string;
  finalHtml: string;       // placeholders replaced
  pdfUrl?: string;
  createdAt: Date;
  status: "draft" | "sent" | "signed_by_franchisee" | "fully_signed";
  franchiseeSignature?: string;
  franchiseeSignedAt?: Date;
  counterSignature?: string;
  counterSignedAt?: Date;
  signedPdfUrl?: string;
}

// Database row types (snake_case from Supabase)
export interface ContractTemplateRow {
  id: string;
  name: string;
  version: string;
  html_content: string;
  placeholders: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface GeneratedContractRow {
  id: string;
  franchisee_id: string;
  template_id: string;
  final_html: string;
  pdf_url: string | null;
  created_at: string;
  status: "draft" | "sent" | "signed_by_franchisee" | "fully_signed";
  franchisee_signature: string | null;
  franchisee_signed_at: string | null;
  counter_signature: string | null;
  counter_signed_at: string | null;
  signed_pdf_url: string | null;
}

// Conversion helpers
export function toContractTemplate(row: ContractTemplateRow): ContractTemplate {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    htmlContent: row.html_content,
    placeholders: row.placeholders,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    updatedBy: row.updated_by,
  };
}

export function toGeneratedContract(row: GeneratedContractRow): GeneratedContract {
  return {
    id: row.id,
    franchiseeId: row.franchisee_id,
    templateId: row.template_id,
    finalHtml: row.final_html,
    pdfUrl: row.pdf_url ?? undefined,
    createdAt: new Date(row.created_at),
    status: row.status,
    franchiseeSignature: row.franchisee_signature ?? undefined,
    franchiseeSignedAt: row.franchisee_signed_at ? new Date(row.franchisee_signed_at) : undefined,
    counterSignature: row.counter_signature ?? undefined,
    counterSignedAt: row.counter_signed_at ? new Date(row.counter_signed_at) : undefined,
    signedPdfUrl: row.signed_pdf_url ?? undefined,
  };
}

// =====================================================
// PLACEHOLDER CATEGORIES - Grouped by data source
// =====================================================

// Business & Legal Information (from franchisee record)
export const BUSINESS_PLACEHOLDERS = [
  { key: "{{legalBusinessName}}", label: "Legal Business Name", description: "Official registered business name" },
  { key: "{{legalEntity}}", label: "Legal Entity Type", description: "LLC, Corp, Sole Proprietor, etc." },
  { key: "{{franchiseLocationName}}", label: "Franchise Location Name", description: "DBA or location-specific name" },
] as const;

// Contact Person Information
export const CONTACT_PLACEHOLDERS = [
  { key: "{{firstName}}", label: "First Name", description: "Signatory's first name" },
  { key: "{{lastName}}", label: "Last Name", description: "Signatory's last name" },
  { key: "{{fullName}}", label: "Full Name", description: "First + Last name combined" },
  { key: "{{email}}", label: "Email Address", description: "Primary contact email" },
  { key: "{{positionTitle}}", label: "Position/Title", description: "Owner, Manager, etc." },
  { key: "{{businessPhone}}", label: "Business Phone", description: "Main business phone number" },
  { key: "{{cellPhone}}", label: "Cell Phone", description: "Mobile phone number" },
] as const;

// Location Address
export const ADDRESS_PLACEHOLDERS = [
  { key: "{{streetAddress}}", label: "Street Address", description: "Full street address" },
  { key: "{{city}}", label: "City", description: "City name" },
  { key: "{{state}}", label: "State", description: "State abbreviation" },
  { key: "{{zipCode}}", label: "ZIP Code", description: "Postal code" },
  { key: "{{fullAddress}}", label: "Full Address", description: "Complete address on one line" },
] as const;

export const PAID_MEDIA_BUDGET_PLACEHOLDER = {
  key: "{{paid_media_budget}}",
  label: "Annual Paid Media Buy Budget",
  description: "Annual paid media buy budget collected during onboarding",
} as const;

// Brand & Plan Information
export const BRAND_PLACEHOLDERS = [
  { key: "{{brandName}}", label: "Brand Name", description: "Selected franchise brand" },
  { key: "{{portalName}}", label: "Portal Name", description: "Portal/franchisor name" },
  { key: "{{planName}}", label: "Plan Name", description: "Selected service plan" },
  { key: "{{monthlyPrice}}", label: "Monthly Price", description: "Base monthly fee" },
  { key: "{{setupFee}}", label: "Setup Fee", description: "One-time setup fee" },
  { key: "{{paidMediaFee}}", label: "Paid Media Fee", description: "Additional paid media monthly fee" },
  PAID_MEDIA_BUDGET_PLACEHOLDER,
  { key: "{{totalMonthlyPrice}}", label: "Total Monthly Price", description: "Base + Paid Media (if applicable)" },
] as const;

// Dates
export const DATE_PLACEHOLDERS = [
  { key: "{{effectiveDate}}", label: "Effective Date", description: "Service start date" },
  { key: "{{signatureDate}}", label: "Signature Date", description: "Date of signature (auto-populated)" },
  { key: "{{grandOpeningDate}}", label: "Grand Opening Date", description: "For new locations only" },
  { key: "{{currentDate}}", label: "Current Date", description: "Today's date" },
] as const;

// Representative Information
export const REP_PLACEHOLDERS = [
  { key: "{{campaignRepName}}", label: "Campaign Rep Name", description: "Campaign representative name" },
  { key: "{{campaignRepEmail}}", label: "Campaign Rep Email", description: "Campaign rep email" },
  { key: "{{campaignRepPhone}}", label: "Campaign Rep Phone", description: "Campaign rep phone" },
  { key: "{{billingRepName}}", label: "Billing Rep Name", description: "Billing representative name" },
  { key: "{{billingRepEmail}}", label: "Billing Rep Email", description: "Billing rep email" },
  { key: "{{billingRepPhone}}", label: "Billing Rep Phone", description: "Billing rep phone" },
] as const;

// Signature Blocks - These get replaced with actual signature images
export const SIGNATURE_PLACEHOLDERS = [
  { key: "{{franchiseeSignature}}", label: "Franchisee Signature", description: "Signature image (auto-inserted)" },
  { key: "{{counterSignature}}", label: "Counter-Signature", description: "Admin signature (auto-inserted)" },
  { key: "{{franchiseeSignedDate}}", label: "Franchisee Signed Date", description: "Date franchisee signed" },
  { key: "{{counterSignedDate}}", label: "Counter-Signed Date", description: "Date admin counter-signed" },
] as const;

// All placeholders combined for the dropdown
export const ALL_PLACEHOLDER_GROUPS = [
  { label: "Business Information", placeholders: BUSINESS_PLACEHOLDERS },
  { label: "Contact Person", placeholders: CONTACT_PLACEHOLDERS },
  { label: "Location Address", placeholders: ADDRESS_PLACEHOLDERS },
  { label: "Brand & Plan", placeholders: BRAND_PLACEHOLDERS },
  { label: "Dates", placeholders: DATE_PLACEHOLDERS },
  { label: "Representatives", placeholders: REP_PLACEHOLDERS },
  { label: "Signatures", placeholders: SIGNATURE_PLACEHOLDERS },
] as const;

// Flat list for backward compatibility
export const COMMON_PLACEHOLDERS = [
  ...BUSINESS_PLACEHOLDERS.map(p => p.key),
  ...CONTACT_PLACEHOLDERS.map(p => p.key),
  ...ADDRESS_PLACEHOLDERS.map(p => p.key),
  ...BRAND_PLACEHOLDERS.map(p => p.key),
  ...DATE_PLACEHOLDERS.map(p => p.key),
  ...REP_PLACEHOLDERS.map(p => p.key),
  ...SIGNATURE_PLACEHOLDERS.map(p => p.key),
] as const;

// Section markers for conditional content.
// Uses {{}} format so they are stored as-is without HTML-escaping angle brackets.
export const SECTION_MARKERS = {
  EARNED_MEDIA_START: "{{#section:Earned Media}}",
  EARNED_MEDIA_END: "{{/section:Earned Media}}",
  PAID_MEDIA_START: "{{#section:Paid Media}}",
  PAID_MEDIA_END: "{{/section:Paid Media}}",
  OTHER_START: "{{#section:Other}}",
  OTHER_END: "{{/section:Other}}",
  NEW_LOCATION_START: "{{#section:NewLocation}}",
  NEW_LOCATION_END: "{{/section:NewLocation}}",
} as const;

/** All variable names the system can replace (placeholders + section markers). Used to detect unrecognized {{...}} in templates. */
export const KNOWN_PLACEHOLDER_KEYS = new Set<string>([
  ...COMMON_PLACEHOLDERS,
  PAID_MEDIA_BUDGET_PLACEHOLDER.key,
  ...(Object.values(SECTION_MARKERS) as string[]),
]);

// Helper type for placeholder values
export type PlaceholderValues = Record<string, string>;
