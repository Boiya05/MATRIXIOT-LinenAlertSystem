/**
 * app/admin.tsx
 *
 * Assign viewer/staff/admin access to an account by email - the
 * in-app replacement for hand-editing SQL in the Supabase dashboard.
 * Reached from Settings → Admin (only shown there to admins - see
 * app/(tabs)/settings.tsx), not its own tab, same "reachable screen,
 * not a tab" pattern as app/activity.tsx. Mirrors the web dashboard's
 * Admin page (app/admin/page.tsx).
 */

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { SkeletonRowList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { listRoleAssignments, setUserRole, type RoleAssignment } from '@/data/admin';
import type { UserRole } from '@/data/user-role';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useThemeColor } from '@/hooks/use-theme-color';

const ROLE_OPTIONS: UserRole[] = ['viewer', 'staff', 'admin'];

const ROLE_EMOJI: Record<UserRole, string> = {
  admin: '🛡️ Admin',
  staff: '🔧 Staff',
  viewer: '👀 Viewer',
};

/**
 * Confirms before assigning a role away from 'admin' on the signed-in
 * account's own email - if they're the only admin, demoting
 * themselves means nobody's left who can use this screen afterward,
 * short of the manual SQL bootstrap again (see this app's README,
 * "Admin role").
 */
function confirmIfSelfDemotion(
  targetEmail: string,
  newRole: UserRole,
  ownEmail: string | null | undefined,
  onConfirmed: () => void
) {
  if (newRole === 'admin' || !ownEmail || targetEmail.toLowerCase() !== ownEmail.toLowerCase()) {
    onConfirmed();
    return;
  }
  Alert.alert(
    'This is your own account',
    "If you're the only admin, demoting yourself means nobody can assign roles from this screen afterward - you'd need the manual SQL bootstrap again. Continue?",
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: onConfirmed },
    ]
  );
}

export default function AdminScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');
  const { user, isAdmin, roleLoading } = useAuth();

  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedOnce = useHasLoadedOnce(loading);

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [assigning, setAssigning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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
  }, [isAdmin]);

  async function doAssign(targetEmail: string, role: UserRole) {
    setAssigning(true);
    setStatus(null);
    try {
      const result = await setUserRole(targetEmail, role);
      setStatus(result.message);
      if (result.success) {
        setEmail('');
        load();
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to assign role.');
    } finally {
      setAssigning(false);
    }
  }

  function handleAssign() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || assigning) return;
    confirmIfSelfDemotion(trimmedEmail, selectedRole, user?.email, () => doAssign(trimmedEmail, selectedRole));
  }

  function handleRowPress(assignment: RoleAssignment) {
    if (!assignment.email || rowUpdating) return;
    Alert.alert(
      assignment.email,
      'Change this account’s role:',
      [
        ...ROLE_OPTIONS.filter((role) => role !== assignment.role).map((role) => ({
          text: ROLE_EMOJI[role],
          onPress: () =>
            confirmIfSelfDemotion(assignment.email!, role, user?.email, async () => {
              setRowUpdating(assignment.userId);
              try {
                const result = await setUserRole(assignment.email!, role);
                if (result.success) {
                  load();
                } else {
                  Alert.alert('Failed', result.message);
                }
              } catch (err) {
                Alert.alert('Failed', err instanceof Error ? err.message : 'Failed to assign role.');
              } finally {
                setRowUpdating(null);
              }
            }),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: '🛡️ Admin' }} />

      {!roleLoading && !isAdmin ? (
        <View style={styles.centerNotice}>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            🔒 This screen is for admin accounts only.
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={styles.form}>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
              Assign viewer / staff / admin access to an account by email.
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: border, color: colors.text }]}
              placeholder="someone@example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => {
                const selected = role === selectedRole;
                return (
                  <PressableScale key={role} onPress={() => setSelectedRole(role)} style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.rolePill,
                        { borderColor: colors.border, backgroundColor: selected ? colors.tint : 'transparent' },
                      ]}>
                      <ThemedText
                        style={{ color: selected ? colors.background : colors.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
                        {ROLE_EMOJI[role]}
                      </ThemedText>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
            <PrimaryButton title="Assign" onPress={handleAssign} disabled={!email.trim()} loading={assigning} />
            {status && <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>{status}</ThemedText>}
          </View>

          {loadError && (
            <ThemedText style={[styles.errorText, { color: colors.danger }]}>{loadError}</ThemedText>
          )}

          {!hasLoadedOnce ? (
            <View style={styles.listContent}>
              <SkeletonRowList />
            </View>
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.userId}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.tint} />}
              renderItem={({ item }) => (
                <PressableScale onPress={() => handleRowPress(item)} disabled={!item.email}>
                  <View style={[styles.assignmentRow, { backgroundColor: colors.cardBackground, borderColor: border }]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 13.5 }} numberOfLines={1}>
                        {item.email ?? '— (assigned before email tracking)'}
                      </ThemedText>
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 11.5, marginTop: 2 }}>
                        Updated {new Date(item.updatedAt).toLocaleString()}
                      </ThemedText>
                    </View>
                    {rowUpdating === item.userId ? (
                      <ActivityIndicator color={colors.tint} size="small" />
                    ) : (
                      <View style={[styles.roleBadge, { backgroundColor: `${colors.tint}18` }]}>
                        <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: colors.tint }}>
                          {ROLE_EMOJI[item.role]}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </PressableScale>
              )}
              ListEmptyComponent={
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>
                  No accounts have a role assigned yet.
                </ThemedText>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerNotice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rolePill: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  errorText: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
