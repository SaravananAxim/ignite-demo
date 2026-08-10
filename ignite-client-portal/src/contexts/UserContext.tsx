import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PORTAL } from '@/constants';

export type AppRole = 'admin' | 'franchisee' | 'super_admin';

export interface SignInWithOtpOptions {
  emailRedirectTo?: string;
  data?: Record<string, unknown>;
  shouldCreateUser?: boolean;
}

interface UserContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>, emailRedirectTo?: string) => Promise<{ error: Error | null }>;
  signInWithOtp: (email: string, options?: SignInWithOtpOptions) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const roleRef = useRef<AppRole | null>(null);
  roleRef.current = role;

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role as AppRole | null;
    } catch (err) {
      console.error('Exception fetching user role:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    // Only show full-page auth loading when we don't have a role yet (initial load / first fetch).
    // When Supabase fires TOKEN_REFRESHED on tab return, we must not set roleLoading or the
    // whole app unmounts and remounts (looks like a page refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          const alreadyHaveRole = roleRef.current !== null;
          if (!alreadyHaveRole) {
            setRoleLoading(true);
          }
          setTimeout(() => {
            if (!isMounted) return;
            fetchUserRole(session.user.id).then((fetchedRole) => {
              if (isMounted) {
                setRole(fetchedRole);
                setRoleLoading(false);
                setLoading(false);
              }
            });
          }, 0);
        } else {
          setRole(null);
          setRoleLoading(false);
          // Do NOT set loading false here - let getSession() be the single source for initial
          // load. Otherwise INITIAL_SESSION can fire with null before getSession() resolves
          // and we briefly show a blank screen.
        }

        if (event === 'SIGNED_OUT') {
          setRole(null);
          setRoleLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setRoleLoading(true);
        fetchUserRole(session.user.id).then((fetchedRole) => {
          if (isMounted) {
            setRole(fetchedRole);
            setRoleLoading(false);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>, emailRedirectTo?: string) => {
    const redirectUrl = emailRedirectTo ?? `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithOtp = async (email: string, options?: SignInWithOtpOptions) => {
    const opts: { emailRedirectTo?: string; data?: Record<string, unknown>; shouldCreateUser?: boolean } = {};
    if (options?.emailRedirectTo != null) opts.emailRedirectTo = options.emailRedirectTo;
    if (options?.data != null) opts.data = options.data;
    if (options?.shouldCreateUser != null) opts.shouldCreateUser = options.shouldCreateUser;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: Object.keys(opts).length ? opts : undefined,
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (email: string, token: string) => {
    // Try verifying as login OTP (type: 'email') first
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      // If login OTP fails, try verifying as signup OTP (type: 'signup')
      const signupResult = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      return { error: signupResult.error as Error | null };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    
    // Clear all sensitive client-side data
    try {
      // Clear form drafts (keep the prefix pattern)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('form_draft_') || key.startsWith('session_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem(PORTAL.STORAGE_KEY_SUBDOMAIN);
      // Clear session storage
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  // Combined loading state - true if initial load OR role fetch in progress
  const isLoading = loading || roleLoading;

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        role,
        isAuthenticated: !!session,
        loading: isLoading,
        signIn,
        signUp,
        signInWithOtp,
        verifyOtp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
