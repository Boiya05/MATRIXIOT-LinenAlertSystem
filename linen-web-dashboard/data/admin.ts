/**
 * data/admin.ts
 *
 * Everything the Admin page needs - listing current role assignments
 * and changing one. Every actual privilege check happens server-side
 * (Row Level Security for the list, admin_set_user_role()'s own
 * internal check for the write - see the mobile app's README, "Admin
 * role") - this file is just the client-side wrapper, not where the
 * real security boundary lives.
 */

import { supabase } from '@/lib/supabase';
import type { UserRole } from './user-role';

export interface RoleAssignment {
  userId: string;
  email: string | null;
  role: UserRole;
  updatedAt: string;
}

function mapRowToRoleAssignment(row: {
  user_id: string;
  email: string | null;
  role: string;
  updated_at: string;
}): RoleAssignment {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role === 'admin' || row.role === 'staff' ? row.role : 'viewer',
    updatedAt: row.updated_at,
  };
}

/**
 * Every account that currently has a user_roles row, newest-updated
 * first. Only returns anything useful for an admin - a non-admin only
 * ever sees their own row, per the "Users can view their own role"
 * policy, so this naturally comes back with just that one row for
 * them rather than needing its own gate here; the Admin page itself
 * is what actually keeps non-admins off this screen (see isAdmin in
 * contexts/auth-context.tsx).
 */
export async function listRoleAssignments(): Promise<RoleAssignment[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, email, role, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load role assignments: ${error.message}`);
  }

  return (data ?? []).map(mapRowToRoleAssignment);
}

export interface SetUserRoleResult {
  success: boolean;
  message: string;
}

/**
 * Assign a role to whichever account matches this email - the one
 * write path for user_roles, going through the admin_set_user_role()
 * Postgres function instead of a direct table write, since resolving
 * an email to a user id has to happen server-side (auth.users isn't
 * reachable from here at all). Reports success/failure in its own
 * response rather than throwing on a miss - "no account with that
 * email yet" is an expected, everyday outcome here, not an
 * exceptional one.
 */
export async function setUserRole(email: string, role: UserRole): Promise<SetUserRoleResult> {
  const { data, error } = await supabase.rpc('admin_set_user_role', {
    target_email: email.trim().toLowerCase(),
    new_role: role,
  });

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }

  const result = data?.[0];
  return {
    success: result?.success ?? false,
    message: result?.message ?? 'Unknown error.',
  };
}
