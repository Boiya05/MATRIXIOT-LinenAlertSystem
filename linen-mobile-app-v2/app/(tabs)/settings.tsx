import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemePreference, type ThemePreference } from '@/contexts/theme-preference-context';
import { getUserSettings, saveUserSettings } from '@/data/user-settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ensureNotificationPermission, requestNotificationPermission } from '@/lib/notifications';

const THEME_OPTIONS: { value: ThemePreference; label: string; emoji: string }[] = [
  { value: 'system', label: 'System', emoji: '🌓' },
  { value: 'light', label: 'Light', emoji: '☀️' },
  { value: 'dark', label: 'Dark', emoji: '🌙' },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');
  const { user, signOut } = useAuth();
  const { themePreference, setThemePreference } = useThemePreference();

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.id)
      .then((settings) => {
        setAlertsEnabled(settings.alertsEnabled);
        setSoundEnabled(settings.soundEnabled);
        // Catches the case where "Theft alerts" was already saved as on
        // from before notifications existed - the toggle below only
        // requests permission on an actual off->on flip, which never
        // happens for a setting that loads in already-on.
        if (settings.alertsEnabled) {
          ensureNotificationPermission();
        }
      })
      .catch((err) => {
        console.warn('Failed to load settings:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const updateSettings = (next: { alertsEnabled: boolean; soundEnabled: boolean }) => {
    setAlertsEnabled(next.alertsEnabled);
    setSoundEnabled(next.soundEnabled);
    if (user) {
      saveUserSettings(user.id, next).catch((err) => {
        console.warn('Failed to save settings:', err);
      });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.warn('Failed to sign out:', err);
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">⚙️ Settings</ThemedText>
        </View>

        <SettingsSection title="🎨 Appearance">
          <View
            style={[styles.row, styles.themeRow, { backgroundColor: colors.cardBackground, borderColor: border }]}>
            <View style={styles.themeRowHeader}>
              <View style={[styles.rowIconWrap, { backgroundColor: `${colors.tint}22` }]}>
                <ThemedText style={styles.themeRowIcon}>🎨</ThemedText>
              </View>
              <View style={styles.rowTextWrap}>
                <ThemedText type="defaultSemiBold">Theme</ThemedText>
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Choose how the app looks
                </ThemedText>
              </View>
            </View>

            <View style={[styles.themeSegmented, { borderColor: border }]}>
              {THEME_OPTIONS.map((option) => {
                const active = option.value === themePreference;
                return (
                  <PressableScale
                    key={option.value}
                    onPress={() => setThemePreference(option.value)}
                    style={[styles.themeSegment, active && { backgroundColor: colors.tint }]}>
                    <ThemedText
                      style={[
                        styles.themeSegmentText,
                        { color: active ? colors.background : colors.textSecondary },
                      ]}>
                      {option.emoji} {option.label}
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title="🔔 Notifications">
          <SettingsRow
            icon="bell.fill"
            label="Theft alerts"
            description="Get notified when a flagged item is scanned"
            color={colors}
            border={border}>
            {loading ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <Switch
                value={alertsEnabled}
                onValueChange={(value) => {
                  updateSettings({ alertsEnabled: value, soundEnabled });
                  // Turning this on is the natural moment to ask for
                  // notification permission - it's an explicit, in-context
                  // action, not a surprise prompt on launch. If denied,
                  // the toggle (and in-app alerts on Home) still work;
                  // only the outside-the-app notification won't fire.
                  if (value) {
                    requestNotificationPermission().then((granted) => {
                      if (!granted) {
                        Alert.alert(
                          'Notifications disabled',
                          "You'll still see alerts on the Home screen, but to get notified outside the app, allow notifications for this app in your phone's Settings."
                        );
                      }
                    });
                  }
                }}
              />
            )}
          </SettingsRow>
          <SettingsRow
            icon="exclamationmark.triangle.fill"
            label="Alert sound"
            description="Play a sound with theft alerts"
            color={colors}
            border={border}>
            {loading ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <Switch
                value={soundEnabled}
                onValueChange={(value) => updateSettings({ alertsEnabled, soundEnabled: value })}
              />
            )}
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="👤 Account">
          <SettingsRow
            icon="person.fill"
            label={user?.email ?? 'Signed in'}
            description="Settings above are saved to this account"
            color={colors}
            border={border}
          />
          <PressableScale
            onPress={handleSignOut}
            disabled={signingOut}
            style={[styles.row, styles.signOutRow, { backgroundColor: colors.cardBackground, borderColor: border }]}>
            {signingOut ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <ThemedText style={{ color: colors.danger, fontWeight: '600' }}>Log Out</ThemedText>
            )}
          </PressableScale>
        </SettingsSection>

        <SettingsSection title="ℹ️ About">
          <SettingsRow
            icon="checkmark.seal.fill"
            label="Linen RFID Detection System"
            description="Mobile companion app · version 0.1.0"
            color={colors}
            border={border}
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const textSecondary = useThemeColor({}, 'textSecondary');
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  description,
  color,
  border,
  children,
}: {
  icon: IconSymbolName;
  label: string;
  description: string;
  color: (typeof Colors)['light'];
  border: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.row, { backgroundColor: color.cardBackground, borderColor: border }]}>
      <View style={[styles.rowIconWrap, { backgroundColor: `${color.tint}22` }]}>
        <IconSymbol name={icon} size={18} color={color.tint} />
      </View>
      <View style={styles.rowTextWrap}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText style={{ color: color.textSecondary, fontSize: 13 }}>{description}</ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  header: {
    gap: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  signOutRow: {
    justifyContent: 'center',
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  themeRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
  },
  themeRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeRowIcon: {
    fontSize: 18,
  },
  themeSegmented: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  themeSegment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  themeSegmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
