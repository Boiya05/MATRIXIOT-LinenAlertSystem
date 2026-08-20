import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';

type StatCardProps = {
  label: string;
  value: number;
  icon: IconSymbolName;
  color: string;
  /** Small decorative emoji shown next to the label, e.g. "🛏️". */
  emoji?: string;
};

/**
 * One tile in the Home screen's stats grid (e.g. "In Use — 11"). Tinted
 * with a soft wash of its own `color` so the four cards read as
 * distinct categories at a glance, not just a same-looking grid.
 */
export function StatCard({ label, value, icon, color, emoji }: StatCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        <IconSymbol name={icon} size={18} color={color} />
      </View>
      <ThemedText type="title" style={styles.value}>
        {value}
      </ThemedText>
      <ThemedText style={styles.label}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    lineHeight: 30,
  },
  label: {
    fontSize: 13,
    opacity: 0.7,
  },
});
