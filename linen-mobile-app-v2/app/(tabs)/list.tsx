import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import {
  getActiveRooms,
  getGroupedByType,
  type LinenStatus,
  type RoomSummary,
  type TypeSummary,
} from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useThemeColor } from '@/hooks/use-theme-color';

const SEGMENTS: LinenStatus[] = ['In Use', 'Laundry', 'Storage'];

export default function ListViewScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { items, loading, error, refresh } = useLinenItems();
  const [selectedStatus, setSelectedStatus] = useState<LinenStatus>('In Use');

  const rooms = useMemo(() => getActiveRooms(items), [items]);
  const categories = useMemo(
    () => getGroupedByType(items, selectedStatus),
    [items, selectedStatus]
  );

  const isInUse = selectedStatus === 'In Use';
  const statusColor =
    selectedStatus === 'In Use'
      ? colors.statusInUse
      : selectedStatus === 'Laundry'
        ? colors.statusLaundry
        : colors.statusStorage;
  const statusIcon: IconSymbolName = isInUse
    ? 'door.left.hand.open'
    : selectedStatus === 'Laundry'
      ? 'arrow.triangle.2.circlepath'
      : 'archivebox.fill';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="title">Linen</ThemedText>
        <ThemedText style={{ color: colors.textSecondary }}>
          {isInUse
            ? `${rooms.length} room${rooms.length === 1 ? '' : 's'} currently holding linen`
            : `${categories.length} item type${categories.length === 1 ? '' : 's'} in ${selectedStatus}`}
        </ThemedText>
      </View>

      <View style={[styles.segmented, { backgroundColor: colors.cardBackground, borderColor: border }]}>
        {SEGMENTS.map((status) => {
          const active = status === selectedStatus;
          return (
            <Pressable
              key={status}
              onPress={() => setSelectedStatus(status)}
              style={[styles.segment, active && { backgroundColor: colors.tint }]}>
              <ThemedText
                style={[
                  styles.segmentText,
                  { color: active ? colors.background : colors.textSecondary },
                ]}>
                {status}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {error && <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>}

      {isInUse ? (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room.roomNumber}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
          renderItem={({ item }) => (
            <RoomRow room={item} color={colors} border={border} iconColor={statusColor} />
          )}
          ListEmptyComponent={
            !loading ? (
              <ThemedText style={{ color: colors.textSecondary }}>
                No rooms currently have linen in use.
              </ThemedText>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(category) => category.itemType}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
          renderItem={({ item }) => (
            <CategoryRow
              category={item}
              status={selectedStatus}
              color={colors}
              border={border}
              icon={statusIcon}
              iconColor={statusColor}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <ThemedText style={{ color: colors.textSecondary }}>
                No items currently in {selectedStatus}.
              </ThemedText>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function RoomRow({
  room,
  color,
  border,
  iconColor,
}: {
  room: RoomSummary;
  color: (typeof Colors)['light'];
  border: string;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/room/${room.roomNumber}`)}
      style={({ pressed }) => [
        styles.rowCard,
        { backgroundColor: color.cardBackground, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.rowIconWrap, { backgroundColor: `${iconColor}22` }]}>
        <IconSymbol name="door.left.hand.open" size={20} color={iconColor} />
      </View>

      <View style={styles.rowTextWrap}>
        <ThemedText type="defaultSemiBold">Room {room.roomNumber}</ThemedText>
        <ThemedText style={{ color: color.textSecondary, fontSize: 13 }}>
          {room.customerName} · {room.itemCount} item{room.itemCount === 1 ? '' : 's'}
        </ThemedText>
      </View>

      <IconSymbol name="chevron.right" size={16} color={color.textSecondary} />
    </Pressable>
  );
}

function CategoryRow({
  category,
  status,
  color,
  border,
  icon,
  iconColor,
}: {
  category: TypeSummary;
  status: LinenStatus;
  color: (typeof Colors)['light'];
  border: string;
  icon: IconSymbolName;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/category', params: { status, itemType: category.itemType } })
      }
      style={({ pressed }) => [
        styles.rowCard,
        { backgroundColor: color.cardBackground, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.rowIconWrap, { backgroundColor: `${iconColor}22` }]}>
        <IconSymbol name={icon} size={20} color={iconColor} />
      </View>

      <View style={styles.rowTextWrap}>
        <ThemedText type="defaultSemiBold">{category.itemType}</ThemedText>
      </View>

      <View style={[styles.countBadge, { backgroundColor: `${iconColor}22` }]}>
        <ThemedText style={[styles.countBadgeText, { color: iconColor }]}>{category.count}</ThemedText>
      </View>

      <IconSymbol name="chevron.right" size={16} color={color.textSecondary} />
    </Pressable>
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
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
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
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  countBadge: {
    borderRadius: 999,
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
