import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // On success, the auth listener updates the session and the
      // root layout automatically switches to the main app.
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
            <ThemedText type="title">🏨 Linen RFID</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              Log in to view live linen status and alerts
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
              autoComplete="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}

            <PrimaryButton title="Log In" onPress={handleLogIn} loading={submitting} style={styles.button} />

            <Link href="/forgot-password" style={styles.link}>
              <ThemedText style={{ color: colors.tint, fontSize: 13 }}>Forgot password?</ThemedText>
            </Link>

            <Link href="/signup" style={styles.link}>
              <ThemedText style={{ color: colors.tint, fontSize: 13 }}>
                {"Don't have an account? Sign up"}
              </ThemedText>
            </Link>
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
