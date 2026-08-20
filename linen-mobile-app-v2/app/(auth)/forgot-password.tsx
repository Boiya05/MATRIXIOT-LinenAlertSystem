import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
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
            <ThemedText type="title">🔑 Reset Password</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {sent
                ? "Check your email for a reset link. It'll open this app to set a new password."
                : "Enter your account's email and we'll send a reset link."}
            </ThemedText>
          </View>

          {!sent && (
            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}

              <PressableScale
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.button, { backgroundColor: colors.tint, opacity: submitting ? 0.6 : 1 }]}>
                {submitting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: colors.background }]}>Send Reset Link</ThemedText>
                )}
              </PressableScale>
            </View>
          )}

          <Link href="/login" replace={sent} style={styles.link}>
            <ThemedText style={{ color: colors.tint, fontSize: 13 }}>Back to log in</ThemedText>
          </Link>
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
  link: {
    alignSelf: 'center',
    marginTop: 4,
  },
});
