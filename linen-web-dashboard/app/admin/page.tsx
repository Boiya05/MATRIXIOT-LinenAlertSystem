'use client';

import { useEffect, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { useAuth } from '@/contexts/auth-context';
import { listRoleAssignments, setUserRole, type RoleAssignment } from '@/data/admin';
import type { UserRole } from '@/data/user-role';

const ROLE_OPTIONS: UserRole[] = ['viewer', 'staff', 'admin'];

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  staff: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  viewer: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

// Not a security boundary - RLS and admin_set_user_role()'s own check
// are what actually stop a non-admin from doing anything here, even
// if they land on this page directly (e.g. a bookmarked URL from back
// when they were an admin). This is just what they see when they do.
function AdminOnlyNotice() {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-sm text-slate-500 dark:text-slate-400">🔒 This page is for admin accounts only.</p>
    </div>
  );
}

// Shown before actually assigning a role away from 'admin' on the
// signed-in account's own email - a real footgun otherwise: if
// they're the only admin, there'd be nobody left who can call
// admin_set_user_role() to undo it, short of the manual SQL bootstrap
// again (see the mobile app's README, "Admin role").
function confirmIfSelfDemotion(targetEmail: string, newRole: UserRole, ownEmail: string | null | undefined) {
  if (newRole === 'admin') return true;
  if (!ownEmail || targetEmail.toLowerCase() !== ownEmail.toLowerCase()) return true;
  return window.confirm(
    "This is your own account. If you're the only admin, demoting yourself means nobody can assign roles " +
      'from this screen afterward - you would need the manual SQL bootstrap again. Continue?'
  );
}

export default function AdminPage() {
  const { user, isAdmin, roleLoading } = useAuth();
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [rowUpdating, setRowUpdating] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listRoleAssignments()
      .then((data) => {
        setAssignments(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load role assignments.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || assigning) return;
    if (!confirmIfSelfDemotion(trimmedEmail, selectedRole, user?.email)) return;

    setAssigning(true);
    setAssignMessage(null);
    try {
      const result = await setUserRole(trimmedEmail, selectedRole);
      setAssignMessage({ text: result.message, ok: result.success });
      if (result.success) {
        setEmail('');
        load();
      }
    } catch (err) {
      setAssignMessage({ text: err instanceof Error ? err.message : 'Failed to assign role.', ok: false });
    } finally {
      setAssigning(false);
    }
  }

  async function handleRowRoleChange(assignment: RoleAssignment, newRole: UserRole) {
    if (newRole === assignment.role || !assignment.email) return;
    if (!confirmIfSelfDemotion(assignment.email, newRole, user?.email)) return;

    setRowUpdating(assignment.userId);
    try {
      const result = await setUserRole(assignment.email, newRole);
      if (result.success) {
        load();
      } else {
        window.alert(result.message);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to assign role.');
    } finally {
      setRowUpdating(null);
    }
  }

  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-9">
        <div className="mb-6 animate-fade-in-up">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Admin</h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Assign viewer / staff / admin access to an account by email.
          </p>
        </div>

        {!roleLoading && !isAdmin ? (
          <AdminOnlyNotice />
        ) : (
          <>
            <form
              onSubmit={handleAssign}
              className="animate-fade-in-up mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
            >
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Account email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="someone@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-teal-500/20"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={assigning || !email.trim()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </form>

            {assignMessage && (
              <p
                className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                  assignMessage.ok
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                }`}
              >
                {assignMessage.text}
              </p>
            )}

            {loadError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {loadError}
              </p>
            )}

            <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-500">
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-5 py-3.5" colSpan={3}>
                          <span className="block h-4 w-full animate-shimmer rounded-md" />
                        </td>
                      </tr>
                    ))
                  ) : assignments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                        No accounts have a role assigned yet.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((assignment) => (
                      <tr key={assignment.userId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {assignment.email ?? <span className="text-slate-300 dark:text-slate-600">— (assigned before the email column existed)</span>}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={assignment.role}
                            disabled={rowUpdating === assignment.userId || !assignment.email}
                            onChange={(e) => handleRowRoleChange(assignment, e.target.value as UserRole)}
                            title={!assignment.email ? 'Reassign via the form above once you know their email' : undefined}
                            className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${ROLE_STYLES[assignment.role]}`}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                          {new Date(assignment.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </Protected>
  );
}
