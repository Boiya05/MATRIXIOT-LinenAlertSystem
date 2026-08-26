import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { SkeletonRowList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { deleteLinenItem, getItemsByStatusAndType, logItemEvent, type LinenStatus } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CategoryScreen() {
  const { status, itemType } = useLocalSearchParams<{ status: LinenStatus; itemType: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');
  const { isStaff } = useAuth();

  const { items: allItems, loading, error, refresh } = useLinenItems();
  const items = useMemo(
    () => getItemsByStatusAndType(allItems, status, itemType),
    [allItems, status, itemType]
  );
  // Full-list skeleton only on the very first load; a background refresh
  // of already-visible items just uses the small header spinner instead.
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const showSkeleton = !hasLoadedOnce;

  // Bulk delete - staff only (see this app's README, "Role-based
  // permissions"). Mirrors the web dashboard's Inventory page, adapted
  // to this screen's already-scoped (one status + type) list instead
  // of a flat searchable table.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggleSelectMode() {
    setSelectMode((current) => !current);
    setSelected(new Set());
  }

  function toggleOne(tagId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  function handleDeleteSelected() {
    if (!isStaff || selected.size === 0) return;

    Alert.alert(
      `Delete ${selected.size} item(s)?`,
      "This can't be undone - the tags themselves aren't affected, just their record here.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const itemsByTag = new Map(items.map((item) => [item.tagId, item]));
            setDeleting(true);
            try {
              for (const tagId of selected) {
                await deleteLinenItem(tagId);
                const item = itemsByTag.get(tagId);
                logItemEvent({
                  tagId,
                  eventType: 'deleted',
                  oldStatus: item?.status ?? null,
                  customerName: item?.customerName || null,
                  roomNumber: item?.roomNumber || null,
                  detail: item?.itemType ?? null,
                }).catch((err) => console.warn('Failed to log audit event:', err));
              }
              setSelected(new Set());
              setSelectMode(false);
              refresh();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete some items.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

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
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">{itemType}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>
            {items.length} item{items.length === 1 ? '' : 's'} in {status}
          </ThemedText>
        </View>
        {loading && !showSkeleton && <ActivityIndicator color={colors.tint} style={{ marginRight: isStaff ? 8 : 0 }} />}
        {isStaff && items.length > 0 && (
          <PressableScale onPress={toggleSelectMode} style={[styles.selectToggle, { borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.tint, fontSize: 13, fontWeight: '600' }}>
              {selectMode ? 'Cancel' : 'Select'}
            </ThemedText>
          </PressableScale>
        )}
      </View>

      {error && <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>}

      {selectMode && selected.size > 0 && (
        <View style={[styles.selectionBar, { backgroundColor: `${colors.tint}18`, borderColor: colors.tint }]}>
          <ThemedText style={{ color: colors.tint, fontSize: 13, fontWeight: '600' }}>
            {selected.size} selected
          </ThemedText>
          <PressableScale
            onPress={handleDeleteSelected}
            disabled={deleting}
            style={[styles.deleteButton, { backgroundColor: colors.danger, opacity: deleting ? 0.6 : 1 }]}>
            {deleting ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <ThemedText style={{ color: colors.background, fontSize: 12, fontWeight: '700' }}>
                🗑️ Delete
              </ThemedText>
            )}
          </PressableScale>
        </View>
      )}

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
          renderItem={({ item }) => {
            const isSelected = selected.has(item.tagId);
            const row = (
              <View
                style={[
                  styles.tagCard,
                  {
                    backgroundColor: isSelected ? `${colors.tint}18` : colors.cardBackground,
                    borderColor: isSelected ? colors.tint : border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  },
                ]}>
                {selectMode && (
                  <IconSymbol
                    name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    color={isSelected ? colors.tint : colors.textSecondary}
                  />
                )}
                <ThemedText type="defaultSemiBold">{item.tagId}</ThemedText>
              </View>
            );
            return selectMode ? (
              <PressableScale onPress={() => toggleOne(item.tagId)}>{row}</PressableScale>
            ) : (
              row
            );
          }}
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
  selectToggle: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
