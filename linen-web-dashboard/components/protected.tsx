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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
