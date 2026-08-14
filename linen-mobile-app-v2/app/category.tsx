import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonRowList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { getItemsByStatusAndType, type LinenStatus } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CategoryScreen() {
  const { status, itemType } = useLocalSearchParams<{ status: LinenStatus; itemType: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { items: allItems, loading, error, refresh } = useLinenItems();
  const items = useMemo(
    () => getItemsByStatusAndType(allItems, status, itemType),
    [allItems, status, itemType]
  );
  // Full-list skeleton only on the very first load; a background refresh
  // of already-visible items just uses the small header spinner instead.
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const showSkeleton = !hasLoadedOnce;

  const statusColor =
    status === 'In Use' ? colors.statusInUse : status === 'Laundry' ? colors.statusLaundry : colors.statusStorage;
  const statusIcon: IconSymbolName =
    status === 'Laundry' ? 'arrow.triangle.2.circlepath' : 'archivebox.fill';
  const statusEmoji = status === 'Laundry' ? '🧺' : '📦';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: `${statusEmoji} ${itemType}` }} />

      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${statusColor}22` }]}>
          <IconSymbol name={statusIcon} size={22} color={statusColor} />
        </View>
        <View>
          <ThemedText type="subtitle">{itemType}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>
            {items.length} item{items.length === 1 ? '' : 's'} in {status}
          </ThemedText>
        </View>
        {loading && !showSkeleton && <ActivityIndicator color={colors.tint} style={{ marginLeft: 'auto' }} />}
      </View>

      {error && <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>}

      {showSkeleton ? (
        <View style={styles.listContent}>
          <SkeletonRowList />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.tagId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
          renderItem={({ item }) => (
            <View style={[styles.tagCard, { backgroundColor: colors.cardBackground, borderColor: border }]}>
              <ThemedText type="defaultSemiBold">{item.tagId}</ThemedText>
            </View>
          )}
          ListEmptyComponent={
            <ThemedText style={{ color: colors.textSecondary }}>No items found.</ThemedText>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  tagCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
});
