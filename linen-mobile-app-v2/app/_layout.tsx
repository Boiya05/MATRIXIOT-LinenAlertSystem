import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemePreferenceProvider } from '@/contexts/theme-preference-context';
import { useAuthDeepLink } from '@/hooks/use-auth-deep-link';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureNotifications } from '@/lib/notifications';

// Sets the foreground notification behavior and (Android) creates the
// theft alerts notification channel. A one-time, side-effect-only call
// - see lib/notifications.ts for why this is safe to run at import
// time rather than needing to live inside a component.
configureNotifications();

/**
 * Decides whether to show the logged-in app or the login/signup
 * screens, based on the current auth session. Lives inside
 * AuthProvider (below) so it can read that state.
 *
 * Uses Stack.Protected (expo-router's built-in auth-guard primitive)
 * rather than conditionally rendering different <Stack.Screen> sets -
 * that ad-hoc approach fights the router's own anchor/redirect logic
 * and was the cause of landing on the tabs screen even when logged
 * out. Stack.Protected is the pattern the router expects for this.
 *
 * The isPasswordRecovery branch is checked BEFORE the plain "has a
 * session" branch - a password-reset deep link produces a real
 * session (see hooks/use-auth-deep-link.ts), and without this check
 * first, that session would route straight into the main app instead
 * of the "set a new password" screen it's actually supposed to reach.
 */
function RootNavigator() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useAuthDeepLink();

  if (loading) {
    // Still checking for an existing session on launch - avoid
    // flashing the login screen before we know the real answer.
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={isPasswordRecovery}>
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!isPasswordRecovery && !session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!isPasswordRecovery && !!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // Required ancestor for react-native-gesture-handler's gesture-based
    // components (the swipe-to-dismiss on theft alerts) to work reliably,
    // especially on Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split out from RootLayout so useColorScheme() (which reads from
 * ThemePreferenceProvider above) runs inside the provider, not above it.
 */
function AppShell() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator />
      {/* Status bar icon color follows the resolved app theme, not the
          raw OS setting, so it stays legible even when the user has
          overridden the OS scheme from Settings. */}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = {
  loading: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
