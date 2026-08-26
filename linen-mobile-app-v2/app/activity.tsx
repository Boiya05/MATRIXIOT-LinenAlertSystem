/**
 * app/activity.tsx
 *
 * The audit trail - who registered, edited, moved, or deleted an
 * item, and who triggered or cleared an alert, across all three apps.
 * Reached from the Settings tab (see app/(tabs)/settings.tsx) rather
 * than its own tab - a 6th tab would crowd the tab bar, and this is
 * the same "reachable screen, not a tab" pattern already used by
 * app/category.tsx and app/room/[roomNumber].tsx. Mirrors the web
 * dashboard's Activity page (app/activity/page.tsx).
 */

import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonRowList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { ItemEvent, ItemEventType } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasLoadedOnce } from '@/hooks/use-has-loaded-once';
import { useItemEvents } from '@/hooks/use-item-events';
import { useThemeColor } from '@/hooks/use-theme-color';

// How each event_type reads in the log, and how it's colored - keeps
// the visual weight roughly matched to how significant the event is
// (a theft alert stands out more than a routine status change).
// Mirrors the web dashboard's EVENT_LABELS/EVENT_STYLES.
const EVENT_LABELS: Record<ItemEventType, string> = {
  registered: '📝 Registered',
  edited: '✏️ Edited',
  status_changed: '🔄 Status changed',
  deleted: '🗑️ Deleted',
  alert_triggered: '🚨 Theft alert triggered',
  alert_dismissed: '✅ Alert dismissed',
};

const SOURCE_LABELS: Record<ItemEvent['sourceApp'], string> = {
  desktop: '🖥️ Desktop',
  mobile: '📱 Mobile',
  web: '🌐 Web',
};

function describe(event: ItemEvent): string {
  switch (event.eventType) {
    case 'registered':
      return event.customerName
        ? `Assigned to ${event.customerName} · Room ${event.roomNumber ?? 'unknown'}`
        : 'Registered as unassigned stock';
    case 'status_changed':
      return event.customerName
        ? `${event.oldStatus ?? '?'} → ${event.newStatus ?? '?'} · assigned to ${event.customerName} · Room ${event.roomNumber ?? '?'}`
        : `${event.oldStatus ?? '?'} → ${event.newStatus ?? '?'}`;
    case 'edited':
      return event.detail ?? 'Details updated';
    case 'deleted':
      return event.customerName
        ? `Was ${event.oldStatus ?? 'unknown'} · ${event.customerName} · Room ${event.roomNumber ?? 'unknown'}`
        : `Was ${event.oldStatus ?? 'unknown'} · unassigned stock`;
    case 'alert_triggered':
      return `Marked ${event.oldStatus ?? 'unregistered'} at the exit scanner`;
    case 'alert_dismissed':
      return `Cleared by ${event.actorLabel ?? 'someone'}`;
    default:
      return '';
  }
}

export default function ActivityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const { events, loading, error, refresh } = useItemEvents();
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) =>
      [event.tagId, event.customerName, event.roomNumber, event.detail, event.actorLabel]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [events, query]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: '🕓 Activity' }} />

      <View style={styles.header}>
        <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
          Who registered, edited, moved, or deleted an item, and who triggered or cleared an
          alert. Most recent 200 events.
        </ThemedText>
        <TextInput
          style={[styles.search, { backgroundColor: colors.cardBackground, borderColor: border, color: colors.text }]}
          placeholder="Search tag, guest, room, or who did it"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {error && (
        <ThemedText style={[styles.errorText, { color: colors.danger }]}>
          {error} If this is the first time you&apos;re seeing this, the linen_item_events table
          may not exist in Supabase yet - see this app&apos;s README, &quot;Audit trail (who did
          what, and when)&quot;.
        </ThemedText>
      )}

      {!hasLoadedOnce ? (
        <View style={styles.listContent}>
          <SkeletonRowList />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(event) => String(event.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.tint} />}
          renderItem={({ item: event }) => (
            <View style={[styles.eventCard, { backgroundColor: colors.cardBackground, borderColor: border }]}>
              <View style={styles.eventTopRow}>
                <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>{EVENT_LABELS[event.eventType]}</ThemedText>
                <ThemedText style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary }}>
                  {event.tagId}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {describe(event)}
              </ThemedText>
              <View style={styles.eventBottomRow}>
                <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{event.timestamp}</ThemedText>
                <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>
                  {event.actorLabel ?? 'Unspecified'} · {SOURCE_LABELS[event.sourceApp]}
                </ThemedText>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>
              {events.length === 0 ? 'No activity recorded yet.' : 'Nothing matches that search.'}
            </ThemedText>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
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
  eventCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
