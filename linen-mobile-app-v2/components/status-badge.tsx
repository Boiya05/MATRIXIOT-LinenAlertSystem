import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { LinenStatus } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STATUS_COLOR_KEY = {
  'In Use': 'statusInUse',
  Laundry: 'statusLaundry',
  Storage: 'statusStorage',
} as const satisfies Record<LinenStatus, keyof typeof Colors.light>;

/**
 * A small tinted pill for a linen item's status - In Use (teal),
 * Laundry (amber), Storage (slate). Replaces plain colored text that
 * used to render this inline on every row across List View, category,
 * room, and Activity screens.
 */
export function StatusBadge({ status }: { status: LinenStatus }) {
  const colorScheme = useColorScheme() ?? 'light';
  const color = Colors[colorScheme][STATUS_COLOR_KEY[status]];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}1a` }]}>
      <ThemedText style={[styles.text, { color }]}>{status}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
