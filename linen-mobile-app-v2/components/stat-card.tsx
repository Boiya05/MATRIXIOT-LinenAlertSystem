import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type StatCardProps = {
  label: string;
  value: number;
  icon: IconSymbolName;
  color: string;
};

/** One tile in the Home screen's stats grid (e.g. "In Use — 11"). */
export function StatCard({ label, value, icon, color }: StatCardProps) {
  const cardBackground = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  return (
    <View style={[styles.card, { backgroundColor: cardBackground, borderColor: border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        <IconSymbol name={icon} size={18} color={color} />
      </View>
      <ThemedText type="title" style={styles.value}>
        {value}
      </ThemedText>
      <ThemedText style={styles.label}>{label}</ThemedText>
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