import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignUpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { signUp, session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailMessage, setCheckEmailMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setCheckEmailMessage(null);
    try {
      await signUp(email.trim(), password);
      // If the Supabase project requires email confirmation, signUp()
      // succeeds but doesn't establish a session yet - let the person
      // know to check their inbox instead of just sitting on this
      // screen with no feedback. If confirmation isn't required, the
      // auth listener picks up the new session and the root layout
      // switches to the main app automatically.
      if (!session) {
        setCheckEmailMessage('Account created. Check your email to confirm it, then log in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">🏨 Create Account</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              For staff access to the linen tracking system
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
            {checkEmailMessage && (
              <ThemedText style={{ color: colors.statusInUse, fontSize: 13 }}>
                {checkEmailMessage}
              </ThemedText>
            )}

            <PrimaryButton title="Sign Up" onPress={handleSignUp} loading={submitting} style={styles.button} />

            <PressableScale onPress={() => router.replace('/login')} style={styles.link}>
              <ThemedText style={{ color: colors.tint, fontSize: 13 }}>
                Already have an account? Log in
              </ThemedText>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  header: {
    gap: 6,
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    marginTop: 6,
  },
  link: {
    alignSelf: 'center',
    marginTop: 4,
  },
});
