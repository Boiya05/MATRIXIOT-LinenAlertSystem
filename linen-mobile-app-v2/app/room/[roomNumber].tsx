import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { getItemsForRoom } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function RoomDetailScreen() {
  const { roomNumber } = useLocalSearchParams<{ roomNumber: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { items: allItems, loading, error, refresh } = useLinenItems();
  const items = useMemo(() => getItemsForRoom(allItems, roomNumber), [allItems, roomNumber]);
  const customerName = items[0]?.customerName ?? 'Unknown';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: `Room ${roomNumber}` }} />

      <View style={styles.header}>
        <View style={[styles.customerIconWrap, { backgroundColor: `${colors.tint}22` }]}>
          <IconSymbol name="person.fill" size={22} color={colors.tint} />
        </View>
        <View>
          <ThemedText type="subtitle">{customerName}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>Room {roomNumber}</ThemedText>
        </View>
        {loading && <ActivityIndicator color={colors.tint} style={{ marginLeft: 'auto' }} />}
      </View>

      {error && (
        <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.tagId}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
        renderItem={({ item }) => (
          <View style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: border }]}>
            <View style={styles.itemTextWrap}>
              <ThemedText type="defaultSemiBold">{item.itemType}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                Tag {item.tagId}
              </ThemedText>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${colors.statusInUse}22` }]}>
              <ThemedText style={[styles.statusPillText, { color: colors.statusInUse }]}>
                {item.status}
              </ThemedText>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <ThemedText style={{ color: colors.textSecondary }}>
            No linen currently in use in this room.
          </ThemedText>
        }
      />
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
  errorText: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontSize: 13,
  },
  customerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  itemTextWrap: {
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