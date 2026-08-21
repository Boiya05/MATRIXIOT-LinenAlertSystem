/**
 * data/user-role.ts
 *
 * Reads the signed-in account's row in user_roles (see the mobile
 * app's README, "Role-based permissions") - a missing row means
 * 'viewer', matching that table's documented default. Used by
 * contexts/auth-context.tsx so every page can cheaply check
 * `isStaff` instead of finding out the hard way when a write gets
 * rejected by Row Level Security (see data/linen-data.ts's
 * friendlyWriteError for that safety net).
 */

import { supabase } from '@/lib/supabase';

export type UserRole = 'staff' | 'viewer';

export async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  // Two different "no role" cases fall back to 'viewer' the same way
  // the SQL comment describes: no row for this user yet, or the
  // user_roles table itself doesn't exist yet (a project that hasn't
  // run that migration - PostgREST reports that as a 404-style
  // "PGRST205" error, not a thrown exception). Either way, this
  // shouldn't be a fatal error - staff-only actions will just also
  // fail with a friendly message until the table exists.
  if (error || !data) {
    return 'viewer';
  }

  return data.role === 'staff' ? 'staff' : 'viewer';
}
