import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type SearchInputProps = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * A rounded, bordered search field with a leading icon - matches the
 * web dashboard's Inventory/Activity search boxes. Used for the
 * client-side text filters on those same two screens here.
 */
export function SearchInput({ value, onChangeText, placeholder = 'Search…', ...rest }: SearchInputProps) {
  const backgroundColor = useThemeColor({}, 'cardBackground');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const secondaryColor = useThemeColor({}, 'textSecondary');

  return (
    <View style={[styles.wrap, { backgroundColor, borderColor }]}>
      <IconSymbol name="magnifyingglass" size={16} color={secondaryColor} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={secondaryColor}
        style={[styles.input, { color: textColor }]}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
});
