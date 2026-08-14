import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonRowList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { type AlertEvent } from '@/data/linen-data';
import { useAlertHistory } from '@/hooks/use-alert-history';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { alerts, loading, error, refresh } = useAlertHistory();
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const showSkeleton = !hasLoadedOnce;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="title">🕑 Alert History</ThemedText>
        <ThemedText style={{ color: colors.textSecondary }}>
          {alerts.length} resolved alert{alerts.length === 1 ? '' : 's'}
        </ThemedText>
      </View>

      {error && <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>}

      {showSkeleton ? (
        <View style={styles.listContent}>
          <SkeletonRowList />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(alert) => String(alert.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
          renderItem={({ item }) => (
            // A newly-dismissed alert (arriving live via Realtime) fades
            // and slides into place instead of just popping into the list.
            <Animated.View entering={FadeInDown.duration(300)} layout={LinearTransition}>
              <HistoryRow alert={item} color={colors} border={border} />
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="clock.fill" size={28} color={colors.textSecondary} />
              <ThemedText style={{ color: colors.textSecondary, textAlign: 'center' }}>
                🎉 No resolved alerts yet. Alerts you dismiss on Home show up here.
              </ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function HistoryRow({
  alert,
  color,
  border,
}: {
  alert: AlertEvent;
  color: (typeof Colors)['light'];
  border: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: color.cardBackground, borderColor: border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${color.textSecondary}22` }]}>
        <IconSymbol name="checkmark.seal.fill" size={18} color={color.textSecondary} />
      </View>
      <View style={styles.textWrap}>
        <ThemedText type="defaultSemiBold">{alert.itemType} · {alert.tagId}</ThemedText>
        <ThemedText style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>
          {alert.message}
        </ThemedText>
        <ThemedText style={[styles.timestamp, { color: color.textSecondary }]}>
          {alert.timestamp}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
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
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
});
