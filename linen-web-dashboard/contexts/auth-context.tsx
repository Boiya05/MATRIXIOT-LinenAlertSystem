/**
 * contexts/auth-context.tsx
 *
 * Tracks who's currently logged in (or not) and exposes the actions
 * to log in and log out. Mirrors the mobile app's auth-context.tsx -
 * same Supabase Auth session, same accounts. Unlike the mobile app,
 * there's no public sign-up screen here: management/staff accounts
 * are created directly in the Supabase dashboard (Authentication ->
 * Users), since a management dashboard shouldn't let just anyone
 * register themselves an account.
 *
 * Also tracks `role`/`isStaff`/`isAdmin` - every account can view
 * everything, but only `staff` (or `admin`, a strict superset) can
 * register items, run the exit scanner, or dismiss alerts, and only
 * `admin` can assign roles to other accounts (see the mobile app's
 * README, "Role-based permissions" and "Admin role"). Pages use
 * `isStaff`/`isAdmin` to show a plain-language notice and disable
 * those controls up front, instead of a viewer only finding out via a
 * raw Row Level Security error after clicking something
 * (data/linen-data.ts's friendlyWriteError is the fallback for
 * anywhere that isn't checked yet).
 */

'use client';

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
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Starts true so protected pages can show a loading state instead of
  // flashing the login redirect before an existing session is checked.
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Re-fetches whenever the signed-in user changes (login, logout, or
  // switching accounts) - not on every session refresh, since the
  // role itself doesn't change just because the JWT did.
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
      // Admin is a strict superset of staff - every staff-gated
      // control also has to work for an admin, without needing a
      // separate 'staff' row for the same account.
      isStaff: role === 'staff' || role === 'admin',
      isAdmin: role === 'admin',
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading, role, roleLoading]
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
