import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { SkeletonRowList, SkeletonStatGrid } from '@/components/skeleton';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { getStats } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useTheftAlerts } from '@/hooks/use-theft-alerts';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { items, loading, error, refresh } = useLinenItems();
  const stats = useMemo(() => getStats(items), [items]);
  const { alerts, loading: alertsLoading, error: alertsError, dismiss } = useTheftAlerts();

  // Only show the shimmering placeholders on each screen's genuine first
  // load, tracked separately per list. Gating on `loading && length === 0`
  // instead would re-flash the alerts skeleton every time the last active
  // alert is dismissed - the optimistic update empties the list a moment
  // before the realtime-triggered refetch resolves, and both were
  // momentarily true.
  const hasLoadedStats = useHasLoadedOnce(loading);
  const hasLoadedAlerts = useHasLoadedOnce(alertsLoading);
  const showStatsSkeleton = !hasLoadedStats;
  const showAlertsSkeleton = !hasLoadedAlerts;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}>
        <View style={styles.header}>
          <ThemedText type="title">🏨 Linen Overview</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>
            Live status of every tracked item
          </ThemedText>
        </View>

        {error && (
          <View style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.danger} />
            <View style={styles.alertTextWrap}>
              <ThemedText style={[styles.alertTitle, { color: colors.danger }]}>
                {"Couldn't load data"}
              </ThemedText>
              <ThemedText style={[styles.alertMessage, { color: colors.danger }]}>{error}</ThemedText>
            </View>
          </View>
        )}

        {showStatsSkeleton ? (
          <SkeletonStatGrid />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              label="Total"
              value={stats.total}
              icon="square.grid.2x2.fill"
              color={colors.tint}
              emoji="📊"
            />
            <StatCard
              label="In Use"
              value={stats.inUse}
              icon="checkmark.seal.fill"
              color={colors.statusInUse}
              emoji="🛏️"
            />
            <StatCard
              label="Laundry"
              value={stats.laundry}
              icon="arrow.triangle.2.circlepath"
              color={colors.statusLaundry}
              emoji="🧺"
            />
            <StatCard
              label="Storage"
              value={stats.storage}
              icon="archivebox.fill"
              color={colors.statusStorage}
              emoji="📦"
            />
          </View>
        )}

        <View style={styles.alertsSection}>
          <ThemedText type="defaultSemiBold" style={styles.alertsSectionTitle}>
            🚨 Theft Alerts
          </ThemedText>

          {alertsError && (
            <View style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.danger} />
              <View style={styles.alertTextWrap}>
                <ThemedText style={[styles.alertTitle, { color: colors.danger }]}>
                  {"Couldn't load alerts"}
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
            {showAlertsSkeleton ? (
              <SkeletonRowList count={2} />
            ) : (
              <>
                {alerts.map((alert) => (
                  // Swipe left to reveal a Dismiss action, in addition to
                  // (not instead of) the OK button - not everyone thinks
                  // to swipe, so the visible button stays the reliable
                  // primary way to clear an alert.
                  <Animated.View
                    key={alert.id}
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutUp.duration(200)}
                    layout={LinearTransition}>
                    <Swipeable
                      overshootRight={false}
                      friction={2}
                      rightThreshold={32}
                      renderRightActions={(progress) => (
                        <DismissSwipeAction
                          progress={progress}
                          color={colors.statusInUse}
                          onPress={() => dismiss(alert.id)}
                        />
                      )}>
                      <View style={[styles.alertCard, { backgroundColor: colors.dangerBackground }]}>
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
                        <PressableScale
                          accessibilityLabel="Dismiss alert"
                          hitSlop={8}
                          onPress={() => dismiss(alert.id)}
                          style={[styles.okButton, { borderColor: colors.danger }]}>
                          <ThemedText style={[styles.okButtonText, { color: colors.danger }]}>OK</ThemedText>
                        </PressableScale>
                      </View>
                    </Swipeable>
                  </Animated.View>
                ))}

                {alerts.length === 0 && (
                  <View style={styles.okCard}>
                    <IconSymbol name="checkmark.seal.fill" size={18} color={colors.statusInUse} />
                    <ThemedText style={{ color: colors.textSecondary }}>
                      ✅ All clear — no active alerts.
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The green "Dismiss" panel revealed by swiping a theft alert card left. */
function DismissSwipeAction({
  progress,
  onPress,
  color,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
  color: string;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.swipeAction}>
      <Animated.View style={[styles.swipeActionInner, { backgroundColor: color }, animatedStyle]}>
        <IconSymbol name="checkmark.seal.fill" size={18} color="#fff" />
        <ThemedText style={styles.swipeActionText}>Dismiss</ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  swipeAction: {
    width: 84,
    marginLeft: 8,
  },
  swipeActionInner: {
    flex: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
});
