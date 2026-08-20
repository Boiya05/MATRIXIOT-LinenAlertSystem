import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * A single pulsing placeholder box. Used directly, or composed into the
 * shaped placeholders below (SkeletonRow, SkeletonStatGrid) that mimic
 * real content so the layout doesn't jump once data arrives.
 */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const border = useThemeColor({}, 'border');
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: border }, animatedStyle, style]}
    />
  );
}

/** Placeholder for one list row (icon circle + two lines of text). */
export function SkeletonRow() {
  const cardBackground = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  return (
    <View style={[styles.row, { backgroundColor: cardBackground, borderColor: border }]}>
      <Skeleton width={38} height={38} borderRadius={10} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
      </View>
    </View>
  );
}

/** A short stack of SkeletonRows, e.g. while a list's first page loads. */
export function SkeletonRowList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.rowList}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  );
}

/** Placeholder for the Home screen's 2x2 stat grid. */
export function SkeletonStatGrid() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.statCard}>
          <Skeleton width={34} height={34} borderRadius={10} />
          <Skeleton width={48} height={22} style={styles.statValueGap} />
          <Skeleton width={70} height={12} style={styles.statLabelGap} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowList: {
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '48%',
    borderRadius: 16,
    padding: 16,
  },
  statValueGap: {
    marginTop: 10,
  },
  statLabelGap: {
    marginTop: 6,
  },
});
