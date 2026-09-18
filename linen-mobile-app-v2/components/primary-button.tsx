import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one filled, tint-colored button used for every primary action
 * (Sign In, Save, Assign, Send Reset Link, ...) - replaces each
 * screen's own hand-rolled primary button, matching the web
 * dashboard's teal action buttons.
 */
export function PrimaryButton({ title, onPress, disabled, loading, style }: PrimaryButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, { backgroundColor: tint, opacity: isDisabled ? 0.6 : 1 }, style]}>
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.text}>{title}</ThemedText>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
