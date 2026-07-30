// Application-wide constants

/**
 * Onboarding flow constants
 */
export const ONBOARDING = {
  MIN_START_DATE_DAYS: 7, // Minimum days from today for service start
  FORM_DEBOUNCE_MS: 1000, // Auto-save debounce time
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

/**
 * Contract template defaults
 */
export const CONTRACT = {
  DEFAULT_VERSION: '1.0',
} as const;

/**
 * Authentication constants
 */
export const AUTH = {
  SESSION_CHECK_INTERVAL_MS: 60000, // 1 minute
  TOKEN_REFRESH_BUFFER_MS: 300000, // 5 minutes before expiry
} as const;

/**
 * Date formats
 */
export const DATE_FORMATS = {
  DISPLAY: 'MMM d, yyyy',
  DISPLAY_WITH_TIME: 'MMM d, yyyy h:mm a',
  INPUT: 'yyyy-MM-dd',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const;

/**
 * Status badge colors
 */
export const STATUS_COLORS = {
  // Franchisee status
  pending: 'bg-yellow-100 text-yellow-800',
  payment_completed: 'bg-blue-100 text-blue-800',
  contract_signed: 'bg-indigo-100 text-indigo-800',
  awaiting_countersign: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',

  // Payment status
  trial: 'bg-purple-100 text-purple-800',
  past_due: 'bg-orange-100 text-orange-800',

  // Contract status
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  signed_by_franchisee: 'bg-yellow-100 text-yellow-800',
  fully_signed: 'bg-green-100 text-green-800',
} as const;

/**
 * Status display labels
 */
export const STATUS_LABELS = {
  pending: 'Pending',
  payment_completed: 'Payment Completed',
  contract_signed: 'Contract Signed',
  awaiting_countersign: 'Awaiting Counter-Sign',
  completed: 'Completed',
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  GENERIC: 'An error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  SAVED: 'Changes saved successfully.',
  DELETED: 'Successfully deleted.',
  CREATED: 'Successfully created.',
  UPDATED: 'Successfully updated.',
} as const;

/**
 * Portal configuration
 * Update BASE_DOMAIN when connecting a custom domain with wildcard DNS
 */
export const PORTAL = {
  BASE_DOMAIN: 'rallio.com',
  getPortalUrl: (portalId: string) => `https://signup-qa.rallio.com/onboarding/${portalId}`,
  /** sessionStorage key for persisting the subdomain the user signed up / is using (so we can redirect from root) */
  STORAGE_KEY_SUBDOMAIN: 'portal_subdomain',
} as const;
