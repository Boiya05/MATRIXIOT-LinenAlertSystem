/**
 * contexts/auth-context.tsx
 *
 * Tracks who's currently logged in (or not) and exposes the actions
 * to log in, sign up, sign out, and reset a forgotten password. The
 * root layout uses this to decide whether to show the login screen,
 * the main app, or (mid password reset) the "set a new password"
 * screen.
 *
 * Also tracks `role`/`isStaff` - every account can view everything,
 * but only a `staff` account can register items, run the exit
 * scanner, assign a guest, or delete items (see this app's README,
 * "Role-based permissions"). Screens use `isStaff` to show a plain-
 * language notice and disable those controls up front, instead of
 * someone only finding out via a raw Row Level Security error after
 * tapping something (data/linen-data.ts's friendlyWriteError is the
 * fallback for anywhere that isn't checked yet). Mirrors the web
 * dashboard's copy of this same context.
 */

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getUserRole, type UserRole } from '@/data/user-role';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  roleLoading: boolean;
  isStaff: boolean;
  /**
   * True from the moment a password-recovery deep link establishes a
   * session until updatePassword() succeeds (or the user signs out).
   * The root layout checks this BEFORE the normal "has a session"
   * check, so a recovery link routes to the reset-password screen
   * instead of straight into the main app - Supabase Auth's session
   * from a recovery link is a real, valid session, and would
   * otherwise be indistinguishable from a normal login.
   */
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Where Supabase's password-reset email link sends the user back to -
// a deep link into this app (see app.json's "scheme"), handled by
// hooks/use-auth-deep-link.ts.
const PASSWORD_RESET_REDIRECT_URL = 'linenmobileappv2://reset-password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Starts true so the app can show a loading state instead of
  // flashing the login screen before we've checked for an existing
  // session.
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      // A real sign-in/sign-out - as opposed to the recovery-link
      // session updating in place - means any in-progress recovery
      // flow is over (either finished via updatePassword() calling
      // signOut() itself below, or abandoned by logging in normally).
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Re-fetches whenever the signed-in user changes (login, logout, or
  // switching accounts) - not on every session refresh, since the
  // role itself doesn't change just because the JWT did. Mirrors the
  // web dashboard's identical effect.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    setRoleLoading(true);
    getUserRole(userId)
      .then((fetchedRole) => {
        if (!cancelled) setRole(fetchedRole);
      })
      .catch((err) => {
        console.warn('Failed to load user role:', err);
        if (!cancelled) setRole('viewer');
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      role,
      roleLoading,
      isStaff: role === 'staff',
      isPasswordRecovery,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: PASSWORD_RESET_REDIRECT_URL,
        });
        if (error) throw error;
      },
      async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        // Recovery flow is done - sign out so they log back in with
        // the new password through the normal flow, rather than
        // silently staying signed in on a session that started as a
        // password-reset link. Also clears isPasswordRecovery via the
        // SIGNED_OUT handler above.
        await supabase.auth.signOut();
      },
    }),
    [session, loading, role, roleLoading, isPasswordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
