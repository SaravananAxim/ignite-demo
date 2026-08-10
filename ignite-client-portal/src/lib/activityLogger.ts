import { supabase } from "@/integrations/supabase/client";
import { ACTIVITY_ACTIONS, TARGET_TYPES, ActivityAction, TargetType } from "@/types/activityLog";

interface LogActivityParams {
  action: ActivityAction;
  targetType: TargetType;
  targetId: string;
  details?: Record<string, any>;
}

/**
 * Logs an activity to the activity_logs table
 * Call this function after any significant action (create, update, delete, etc.)
 */
export async function logActivity({
  action,
  targetType,
  targetId,
  details = {},
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Cannot log activity: No authenticated user");
      return;
    }

    const { error } = await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email || "unknown",
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });

    if (error) {
      console.error("Failed to log activity:", error);
    }
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// Convenience functions for common actions
export const activityLogger = {
  // Generic log activity (exported for custom actions)
  logActivity: (action: string, targetType: string, targetId: string, details?: Record<string, any>) =>
    logActivity({
      action: action as ActivityAction,
      targetType: targetType as TargetType,
      targetId,
      details,
    }),

  // Franchisee actions
  franchiseeCreated: (franchiseeId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.FRANCHISEE_CREATED,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: franchiseeId,
      details,
    }),

  franchiseeUpdated: (franchiseeId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.FRANCHISEE_UPDATED,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: franchiseeId,
      details,
    }),

  franchiseeDeleted: (franchiseeId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.FRANCHISEE_DELETED,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: franchiseeId,
      details,
    }),

  franchiseeActivated: (franchiseeId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.FRANCHISEE_ACTIVATED,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: franchiseeId,
      details,
    }),

  franchiseeDeactivated: (franchiseeId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.FRANCHISEE_DEACTIVATED,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: franchiseeId,
      details,
    }),

  // Contract actions
  contractCreated: (contractId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.CONTRACT_CREATED,
      targetType: TARGET_TYPES.CONTRACT,
      targetId: contractId,
      details,
    }),

  contractSent: (contractId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.CONTRACT_SENT,
      targetType: TARGET_TYPES.CONTRACT,
      targetId: contractId,
      details,
    }),

  contractSigned: (contractId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.CONTRACT_SIGNED,
      targetType: TARGET_TYPES.CONTRACT,
      targetId: contractId,
      details,
    }),

  // Template actions
  templateCreated: (templateId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.TEMPLATE_CREATED,
      targetType: TARGET_TYPES.TEMPLATE,
      targetId: templateId,
      details,
    }),

  templateUpdated: (templateId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.TEMPLATE_UPDATED,
      targetType: TARGET_TYPES.TEMPLATE,
      targetId: templateId,
      details,
    }),

  templateDeleted: (templateId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.TEMPLATE_DELETED,
      targetType: TARGET_TYPES.TEMPLATE,
      targetId: templateId,
      details,
    }),

  // Portal actions
  portalCreated: (portalId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.PORTAL_CREATED,
      targetType: TARGET_TYPES.PORTAL,
      targetId: portalId,
      details,
    }),

  portalUpdated: (portalId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.PORTAL_UPDATED,
      targetType: TARGET_TYPES.PORTAL,
      targetId: portalId,
      details,
    }),

  portalDeleted: (portalId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.PORTAL_DELETED,
      targetType: TARGET_TYPES.PORTAL,
      targetId: portalId,
      details,
    }),

  // User actions
  userRoleChanged: (userId: string, details?: Record<string, any>) =>
    logActivity({
      action: ACTIVITY_ACTIONS.USER_ROLE_CHANGED,
      targetType: TARGET_TYPES.USER,
      targetId: userId,
      details,
    }),

  // Bulk actions
  bulkActivate: (count: number, ids: string[]) =>
    logActivity({
      action: ACTIVITY_ACTIONS.BULK_ACTIVATE,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: "bulk",
      details: { count, ids },
    }),

  bulkDeactivate: (count: number, ids: string[]) =>
    logActivity({
      action: ACTIVITY_ACTIONS.BULK_DEACTIVATE,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: "bulk",
      details: { count, ids },
    }),

  bulkDelete: (count: number, ids: string[]) =>
    logActivity({
      action: ACTIVITY_ACTIONS.BULK_DELETE,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: "bulk",
      details: { count, ids },
    }),

  bulkExport: (count: number, format: string) =>
    logActivity({
      action: ACTIVITY_ACTIONS.BULK_EXPORT,
      targetType: TARGET_TYPES.FRANCHISEE,
      targetId: "bulk",
      details: { count, format },
    }),
};
