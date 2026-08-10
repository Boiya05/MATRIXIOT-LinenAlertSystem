import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  // Local-only for now - these don't persist or connect to anything
  // yet. Once the backend is wired up, this is where that state would
  // actually be read from and saved to the user's account settings.
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
        </View>

        <SettingsSection title="Notifications">
          <SettingsRow
            icon="bell.fill"
            label="Theft alerts"
            description="Get notified when a flagged item is scanned"
            color={colors}
            border={border}>
            <Switch value={alertsEnabled} onValueChange={setAlertsEnabled} />
          </SettingsRow>
          <SettingsRow
            icon="exclamationmark.triangle.fill"
            label="Alert sound"
            description="Play a sound with theft alerts"
            color={colors}
            border={border}>
            <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Data">
          <SettingsRow
            icon="arrow.triangle.2.circlepath"
            label="Backend connection"
            description="Not connected yet — using local data"
            color={colors}
            border={border}>
            <View style={[styles.statusPill, { backgroundColor: `${colors.statusStorage}22` }]}>
              <ThemedText style={[styles.statusPillText, { color: colors.statusStorage }]}>
                Offline
              </ThemedText>
            </View>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="About">
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
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});