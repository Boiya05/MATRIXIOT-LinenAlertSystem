import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type CardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
};

/**
 * The one shared "card" surface used everywhere a screen needs a
 * bordered, elevated block - alert rows, item rows, form sections. A
 * direct port of the web dashboard's rounded-2xl + soft-shadow card
 * style (see linen-web-dashboard's `section` classes), replacing the
 * near-identical `styles.card`/`styles.rowCard` every screen used to
 * hand-roll on its own.
 */
export function Card({ style, children, ...rest }: CardProps) {
  const backgroundColor = useThemeColor({}, 'cardBackground');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={[styles.card, { backgroundColor, borderColor }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
});
