/**
 * components/protected.tsx
 *
 * Wraps a page so it only renders once a logged-in session is
 * confirmed - redirects to /login otherwise. Client-side only (no
 * middleware/SSR session check), matching the simple approach used
 * throughout this project: the same publishable key + RLS model as
 * the mobile app, not a server-rendered auth architecture. RLS is
 * still what actually protects the data if this check is bypassed -
 * this redirect is a UX convenience, not the security boundary.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';

export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600 dark:border-slate-700 dark:border-t-teal-500" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
