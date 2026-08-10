import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { ONBOARDING_STEP, FRANCHISEE_STATUS } from '@/types/franchisee';

const STORAGE_KEY = 'pending_onboarding_franchisee';

interface PendingOnboarding {
  franchiseeId: string;
  brandId: string;
  planId: string;
  planIds?: string[];
  savedAt: string;
}

interface OnboardingResumeData {
  franchiseeId: string;
  franchiseeName: string;
  brandName: string;
  planName: string;
  onboardingStep: string;
  paymentStatus: string | null;
  resumeUrl: string;
}

/**
 * Save the franchisee ID for resume capability after payment
 */
export function savePendingOnboarding(
  franchiseeId: string,
  brandId: string,
  planId: string,
  planIds: string[] = [planId],
) {
  const uniquePlanIds = Array.from(new Set(planIds.length > 0 ? planIds : [planId]));
  const data: PendingOnboarding = {
    franchiseeId,
    brandId,
    planId,
    planIds: uniquePlanIds,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Clear the pending onboarding when complete
 */
export function clearPendingOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the pending onboarding data from localStorage
 */
function getPendingOnboarding(): PendingOnboarding | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const data = JSON.parse(stored) as PendingOnboarding;

    if (!data.planIds && data.planId) {
      data.planIds = [data.planId];
    }
    
    // Check if it's older than 7 days
    const savedAt = new Date(data.savedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (savedAt < sevenDaysAgo) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const CONFIRMED_PAYMENT_STATUSES = ['paid', 'authorized', 'trialing'];

/**
 * Get the resume URL based on the onboarding step and payment status
 */
function getResumeUrl(
  franchiseeId: string,
  step: string | null,
  paymentStatus: string | null,
  existingCustomerLogic?: boolean | null,
): string {
  const isExistingCustomerLogicBypass = existingCustomerLogic === true;

  if (isExistingCustomerLogicBypass) {
    return `/onboarding?franchisee_id=${franchiseeId}`;
  }

  // If the step is intake or beyond but payment hasn't been confirmed, send back to payment
  const hasConfirmedPayment = paymentStatus && CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus);
  if (!hasConfirmedPayment && step !== ONBOARDING_STEP.PAYMENT) {
    return `/payment-processing?franchisee_id=${franchiseeId}`;
  }

  switch (step) {
    case ONBOARDING_STEP.PAYMENT:
      return `/payment-processing?franchisee_id=${franchiseeId}`;
    case ONBOARDING_STEP.INTAKE:
      return `/onboarding?franchisee_id=${franchiseeId}`;
    case ONBOARDING_STEP.REPRESENTATIVES:
      return `/representatives?franchisee_id=${franchiseeId}`;
    case ONBOARDING_STEP.CONTRACT:
      return `/contract-review?franchisee_id=${franchiseeId}`;
    case ONBOARDING_STEP.COMPLETE:
      return `/confirmation?franchisee_id=${franchiseeId}`;
    default:
      return `/onboarding?franchisee_id=${franchiseeId}`;
  }
}

/**
 * Hook to check if user has a pending onboarding to resume
 * First checks by user_id (if logged in), then falls back to localStorage
 */
export function useOnboardingResume() {
  const { user } = useUser();
  const [localStorageData, setLocalStorageData] = useState<PendingOnboarding | null>(null);
  
  useEffect(() => {
    setLocalStorageData(getPendingOnboarding());
  }, []);

  // Query for pending franchisee by user_id (if logged in)
  const { data: userFranchisee, isLoading: userLoading } = useQuery({
    queryKey: ['pending-onboarding-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('franchisees')
        .select('*, brands(*), plans(*)')
        .eq('user_id', user.id)
        .neq('onboarding_step', ONBOARDING_STEP.COMPLETE)
        .neq('status', FRANCHISEE_STATUS.CANCELLED)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;

      const { data: selectedPlans } = await supabase
        .from('franchisee_plans')
        .select('category, is_primary, plans(id, name)')
        .eq('franchisee_id', data.id)
        .order('is_primary', { ascending: false })
        .order('category', { ascending: true });

      return { ...data, selectedPlans: selectedPlans ?? [] };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Query for pending franchisee by localStorage ID (fallback for anonymous users)
  const { data: localFranchisee, isLoading: localLoading } = useQuery({
    queryKey: ['pending-onboarding-local', localStorageData?.franchiseeId],
    queryFn: async () => {
      if (!localStorageData?.franchiseeId || user?.id) return null; // Skip if user is logged in
      
      const { data, error } = await supabase
        .from('franchisees')
        .select('*, brands(*), plans(*)')
        .eq('id', localStorageData.franchiseeId)
        .single();
      
      if (error || !data) {
        clearPendingOnboarding();
        return null;
      }
      
      if (data.onboarding_step === ONBOARDING_STEP.COMPLETE || data.status === FRANCHISEE_STATUS.CANCELLED) {
        clearPendingOnboarding();
        return null;
      }
      
      const { data: selectedPlans } = await supabase
        .from('franchisee_plans')
        .select('category, is_primary, plans(id, name)')
        .eq('franchisee_id', data.id)
        .order('is_primary', { ascending: false })
        .order('category', { ascending: true });

      return { ...data, selectedPlans: selectedPlans ?? [] };
    },
    enabled: !!localStorageData?.franchiseeId && !user?.id,
    staleTime: 30000,
  });

  // Determine which franchisee data to use
  const franchisee = userFranchisee || localFranchisee;
  const paymentStatus = franchisee?.payment_status ?? null;
  const canCancelAndSwitch = paymentStatus === 'pending' || paymentStatus === 'pending_checkout';

  const brandDetails = franchisee?.brands as { existing_customer_logic?: boolean; name?: string } | null | undefined;
  const planDetails = franchisee?.plans as { name?: string } | null | undefined;
  const selectedPlanDetails = (franchisee?.selectedPlans ?? []) as Array<{
    category?: string | null;
    plans?: { id?: string; name?: string } | null;
  }>;
  const selectedPlanNames = selectedPlanDetails
    .map((selection) => {
      const planName = selection.plans?.name;
      if (!planName) return null;

      return selection.category ? `${selection.category}: ${planName}` : planName;
    })
    .filter(Boolean);
  const resumeData: OnboardingResumeData | null = franchisee ? {
    franchiseeId: franchisee.id,
    franchiseeName: franchisee.name || 'Your registration',
    brandName: brandDetails?.name || 'Unknown Brand',
    planName: selectedPlanNames.length > 0 ? selectedPlanNames.join(', ') : planDetails?.name || 'Unknown Plan',
    onboardingStep: franchisee.onboarding_step || 'intake',
    paymentStatus: franchisee.payment_status,
    resumeUrl: getResumeUrl(
      franchisee.id,
      franchisee.onboarding_step,
      franchisee.payment_status,
      brandDetails?.existing_customer_logic,
    ),
  } : null;

  const clearResume = () => {
    clearPendingOnboarding();
    setLocalStorageData(null);
  };

  const queryClient = useQueryClient();

  const cancelAndSwitch = useCallback(async (): Promise<{ error?: string }> => {
    if (!franchisee?.id || !canCancelAndSwitch) return { error: 'Cannot cancel' };

    // Re-fetch live status before cancelling — cached data may be stale
    const { data: live } = await supabase
      .from('franchisees')
      .select('payment_status')
      .eq('id', franchisee.id)
      .single();

    const CONFIRMED = ['paid', 'authorized', 'trialing'];
    if (live?.payment_status && CONFIRMED.includes(live.payment_status)) {
      // Payment went through — refresh cache so UI reflects reality
      queryClient.invalidateQueries({ queryKey: ['pending-onboarding-user'] });
      queryClient.invalidateQueries({ queryKey: ['pending-onboarding-local'] });
      return { error: 'Payment already processed. You cannot switch plans.' };
    }

    await supabase
      .from('franchisees')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('id', franchisee.id);
    clearPendingOnboarding();
    setLocalStorageData(null);
    queryClient.invalidateQueries({ queryKey: ['pending-onboarding-user'] });
    queryClient.invalidateQueries({ queryKey: ['pending-onboarding-local'] });
    return {};
  }, [franchisee?.id, canCancelAndSwitch, queryClient]);

  const isLoading = (user?.id ? userLoading : localLoading) || (!user?.id && !!localStorageData && localLoading);

  return {
    hasResume: !!resumeData,
    resumeData,
    isLoading,
    clearResume,
    canCancelAndSwitch,
    cancelAndSwitch,
  };
}
