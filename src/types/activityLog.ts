export interface ActivityLog {
  id: string;
  userId: string | null;
  userEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  ipAddress: string | null;
  createdAt: Date;
}

// Database row type (snake_case from Supabase)
export interface ActivityLogRow {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

// Conversion helper
export function toActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details || {},
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at),
  };
}

// Action types for type safety
export const ACTIVITY_ACTIONS = {
  // Franchisee actions
  FRANCHISEE_CREATED: "franchisee_created",
  FRANCHISEE_UPDATED: "franchisee_updated",
  FRANCHISEE_DELETED: "franchisee_deleted",
  FRANCHISEE_ACTIVATED: "franchisee_activated",
  FRANCHISEE_DEACTIVATED: "franchisee_deactivated",
  
  // Contract actions
  CONTRACT_CREATED: "contract_created",
  CONTRACT_UPDATED: "contract_updated",
  CONTRACT_DELETED: "contract_deleted",
  CONTRACT_SENT: "contract_sent",
  CONTRACT_SIGNED: "contract_signed",
  
  // Template actions
  TEMPLATE_CREATED: "template_created",
  TEMPLATE_UPDATED: "template_updated",
  TEMPLATE_DELETED: "template_deleted",
  
  // Portal actions
  PORTAL_CREATED: "portal_created",
  PORTAL_UPDATED: "portal_updated",
  PORTAL_DELETED: "portal_deleted",
  
  // User actions
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  USER_ROLE_CHANGED: "user_role_changed",
  
  // Bulk actions
  BULK_ACTIVATE: "bulk_activate",
  BULK_DEACTIVATE: "bulk_deactivate",
  BULK_DELETE: "bulk_delete",
  BULK_EXPORT: "bulk_export",
} as const;

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS];

export const TARGET_TYPES = {
  FRANCHISEE: "franchisee",
  CONTRACT: "contract",
  TEMPLATE: "template",
  PORTAL: "portal",
  USER: "user",
  SYSTEM: "system",
} as const;

export type TargetType = typeof TARGET_TYPES[keyof typeof TARGET_TYPES];

// Human-readable action labels
export const ACTION_LABELS: Record<string, string> = {
  franchisee_created: "Created franchisee",
  franchisee_updated: "Updated franchisee",
  franchisee_deleted: "Deleted franchisee",
  franchisee_activated: "Activated franchisee",
  franchisee_deactivated: "Deactivated franchisee",
  contract_created: "Generated contract",
  contract_updated: "Updated contract",
  contract_deleted: "Deleted contract",
  contract_sent: "Sent contract",
  contract_signed: "Signed contract",
  template_created: "Created template",
  template_updated: "Updated template",
  template_deleted: "Deleted template",
  portal_created: "Created portal",
  portal_updated: "Updated portal",
  portal_deleted: "Deleted portal",
  user_login: "User logged in",
  user_logout: "User logged out",
  user_role_changed: "Changed user role",
  bulk_activate: "Bulk activated",
  bulk_deactivate: "Bulk deactivated",
  bulk_delete: "Bulk deleted",
  bulk_export: "Exported data",
};
