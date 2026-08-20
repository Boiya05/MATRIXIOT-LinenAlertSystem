/**
 * contexts/auth-context.tsx
 *
 * Tracks who's currently logged in (or not) and exposes the actions
 * to log in, sign up, sign out, and reset a forgotten password. The
 * root layout uses this to decide whether to show the login screen,
 * the main app, or (mid password reset) the "set a new password"
 * screen.
 */

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
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
    [session, loading, isPasswordRecovery]
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
