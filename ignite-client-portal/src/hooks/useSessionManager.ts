import { useEffect, useCallback, useRef, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SessionManagerOptions {
  onSessionExpired?: () => void;
  onRoleChanged?: (newRole: string | null) => void;
  checkIntervalMs?: number;
}

interface SessionManagerResult {
  isSessionValid: boolean;
  isCheckingSession: boolean;
  sessionExpiresAt: Date | null;
  forceRefresh: () => Promise<void>;
}

export function useSessionManager({
  onSessionExpired,
  onRoleChanged,
  checkIntervalMs = 60000, // Check every minute
}: SessionManagerOptions = {}): SessionManagerResult {
  const { session, role, signOut } = useUser();
  const [isSessionValid, setIsSessionValid] = useState(!!session);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const previousRoleRef = useRef(role);
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Update session expiry time
  useEffect(() => {
    if (session?.expires_at) {
      setSessionExpiresAt(new Date(session.expires_at * 1000));
      setIsSessionValid(true);
    } else {
      setSessionExpiresAt(null);
      setIsSessionValid(false);
    }
  }, [session]);

  // Check for role changes (e.g., admin demoted while logged in)
  useEffect(() => {
    if (previousRoleRef.current !== role && previousRoleRef.current !== null) {
      // Role changed - notify and potentially force re-auth
      onRoleChanged?.(role);
      
      if (role === null && previousRoleRef.current !== null) {
        // User lost their role - sign them out
        toast.error('Your access has been revoked. Please contact an administrator.');
        signOut();
      } else if (role !== previousRoleRef.current) {
        toast.info('Your permissions have been updated. Some features may have changed.');
      }
    }
    previousRoleRef.current = role;
  }, [role, onRoleChanged, signOut]);

  // Force session refresh
  const forceRefresh = useCallback(async () => {
    setIsCheckingSession(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        setIsSessionValid(false);
        onSessionExpired?.();
        toast.error('Your session has expired. Please sign in again.');
        await signOut();
      } else {
        setIsSessionValid(true);
        setSessionExpiresAt(new Date(data.session.expires_at! * 1000));
      }
    } catch {
      setIsSessionValid(false);
    } finally {
      setIsCheckingSession(false);
    }
  }, [onSessionExpired, signOut]);

  // Periodic session check
  useEffect(() => {
    if (!session) return;

    const checkSession = async () => {
      // Only check if session is close to expiry (within 5 minutes)
      if (sessionExpiresAt) {
        const timeToExpiry = sessionExpiresAt.getTime() - Date.now();
        if (timeToExpiry < 5 * 60 * 1000 && timeToExpiry > 0) {
          await forceRefresh();
        } else if (timeToExpiry <= 0) {
          onSessionExpired?.();
          toast.error('Your session has expired. Please sign in again.');
          await signOut();
        }
      }
    };

    const interval = setInterval(checkSession, checkIntervalMs);
    return () => clearInterval(interval);
  }, [session, sessionExpiresAt, checkIntervalMs, forceRefresh, onSessionExpired, signOut]);

  // Handle visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        // User returned to the tab - verify session
        forceRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, forceRefresh]);

  // Cross-tab session sync via storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token' && !e.newValue && session) {
        // Another tab signed out
        toast.info('You have been signed out in another tab.');
        signOut();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [session, signOut]);

  // Broadcast session state on mount
  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem('session_tab', tabId.current);
      } catch {
        // Ignore storage errors
      }
    }
  }, [session]);

  return {
    isSessionValid,
    isCheckingSession,
    sessionExpiresAt,
    forceRefresh,
  };
}
