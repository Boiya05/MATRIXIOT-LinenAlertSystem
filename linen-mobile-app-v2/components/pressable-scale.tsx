import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far to shrink on press, e.g. 0.96. Defaults to a subtle 0.96. */
  scaleTo?: number;
};

/**
 * A Pressable that gives a small spring-scale "press" of tactile
 * feedback, used in place of plain Pressable wherever a tap should feel
 * more physical - room/category rows, primary buttons, segmented
 * controls. Centralizing it here keeps the feel consistent app-wide
 * instead of every screen inventing its own press effect.
 */
export function PressableScale({ style, scaleTo = 0.96, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, { damping: 16, stiffness: 320 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 320 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
