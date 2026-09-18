import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type SectionHeaderProps = {
  title: string;
  /** Optional control rendered on the trailing edge, e.g. a count badge. */
  trailing?: React.ReactNode;
};

/**
 * A small uppercase label above a group of settings rows or cards -
 * replaces the "Appearance"/"Notifications"-style headers each screen
 * used to style locally, matching the web dashboard's section labels.
 */
export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  const color = useThemeColor({}, 'textSecondary');

  return (
    <View style={styles.row}>
      <ThemedText style={[styles.label, { color }]}>{title}</ThemedText>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
