import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { getStats } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useTheftAlerts } from '@/hooks/use-theft-alerts';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { items, loading, error, refresh } = useLinenItems();
  const stats = useMemo(() => getStats(items), [items]);
  const { alerts, error: alertsError, dismiss } = useTheftAlerts();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}>
        <View style={styles.header}>
          <ThemedText type="title">Linen Overview</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>
            Live status of every tracked item
          </ThemedText>
        </View>

        {loading && items.length === 0 && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.tint} />
            <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
          </View>
        )}

        {error && (
          <View style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.danger} />
            <View style={styles.alertTextWrap}>
              <ThemedText style={[styles.alertTitle, { color: colors.danger }]}>
                Couldn't load data
              </ThemedText>
              <ThemedText style={[styles.alertMessage, { color: colors.danger }]}>{error}</ThemedText>
            </View>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard label="Total" value={stats.total} icon="square.grid.2x2.fill" color={colors.tint} />
          <StatCard label="In Use" value={stats.inUse} icon="checkmark.seal.fill" color={colors.statusInUse} />
          <StatCard
            label="Laundry"
            value={stats.laundry}
            icon="arrow.triangle.2.circlepath"
            color={colors.statusLaundry}
          />
          <StatCard label="Storage" value={stats.storage} icon="archivebox.fill" color={colors.statusStorage} />
        </View>

        <View style={styles.alertsSection}>
          <ThemedText type="defaultSemiBold" style={styles.alertsSectionTitle}>
            Theft Alerts
          </ThemedText>

          {alertsError && (
            <View style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.danger} />
              <View style={styles.alertTextWrap}>
                <ThemedText style={[styles.alertTitle, { color: colors.danger }]}>
                  Couldn't load alerts
                </ThemedText>
                <ThemedText style={[styles.alertMessage, { color: colors.danger }]}>
                  {alertsError}
                </ThemedText>
              </View>
            </View>
          )}

          <ScrollView
            style={[styles.alertsScroll, { backgroundColor: colors.cardBackground, borderColor: border }]}
            contentContainerStyle={styles.alertsScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator>
            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.danger} />
                <View style={styles.alertTextWrap}>
                  <ThemedText style={[styles.alertTitle, { color: colors.danger }]}>
                    Theft alert
                  </ThemedText>
                  <ThemedText style={[styles.alertMessage, { color: colors.danger }]}>
                    {alert.message}
                  </ThemedText>
                  <ThemedText style={[styles.alertTimestamp, { color: colors.danger }]}>
                    {alert.timestamp}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityLabel="Dismiss alert"
                  hitSlop={8}
                  onPress={() => dismiss(alert.id)}
                  style={[styles.okButton, { borderColor: colors.danger }]}>
                  <ThemedText style={[styles.okButtonText, { color: colors.danger }]}>OK</ThemedText>
                </Pressable>
              </View>
            ))}

            {alerts.length === 0 && (
              <View style={styles.okCard}>
                <IconSymbol name="checkmark.seal.fill" size={18} color={colors.statusInUse} />
                <ThemedText style={{ color: colors.textSecondary }}>
                  No active alerts. All clear.
                </ThemedText>
              </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  alertsSection: {
    gap: 8,
  },
  alertsSectionTitle: {
    fontSize: 15,
  },
  alertsScroll: {
    maxHeight: 260,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alertsScrollContent: {
    padding: 10,
    gap: 8,
    flexGrow: 1,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
  },
  alertTextWrap: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertTimestamp: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  okButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  okButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  okCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 4,
  },
});