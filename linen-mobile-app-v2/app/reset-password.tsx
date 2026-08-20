import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Only reachable while contexts/auth-context.tsx's isPasswordRecovery
 * is true - see app/_layout.tsx's Stack.Protected guard. Getting here
 * at all means a valid (if short-lived) session already exists, from
 * the reset-link deep link handled in hooks/use-auth-deep-link.ts -
 * this screen's only job is collecting the new password and calling
 * updatePassword(), not re-authenticating.
 */
export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { updatePassword } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(newPassword);
      // updatePassword() signs out on success (see auth-context.tsx),
      // which flips isPasswordRecovery back to false and would
      // already route away from this screen on its own - this just
      // shows a brief confirmation first instead of an instant jump.
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">🔑 Set New Password</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {done
                ? 'Password updated - log in with your new password.'
                : 'Choose a new password for your account.'}
            </ThemedText>
          </View>

          {!done && (
            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="New password"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}

              <PressableScale
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.button, { backgroundColor: colors.tint, opacity: submitting ? 0.6 : 1 }]}>
                {submitting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: colors.background }]}>Update Password</ThemedText>
                )}
              </PressableScale>
            </View>
          )}

          {done && (
            <PressableScale
              onPress={() => router.replace('/login')}
              style={[styles.button, { backgroundColor: colors.tint }]}>
              <ThemedText style={[styles.buttonText, { color: colors.background }]}>Back to Log In</ThemedText>
            </PressableScale>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 32 },
  header: { gap: 6 },
  form: { gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
