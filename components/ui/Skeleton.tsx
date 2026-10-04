import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** One fade, out or back in. A full breath is twice this. */
const PULSE_DURATION_MS = 800;
const PULSE_MIN_OPACITY = 0.45;

interface SkeletonProps {
  /** Size, shape and spacing, e.g. "h-4 w-24 rounded-md". */
  className?: string;
  /** Only for values that have no Tailwind class (computed at runtime). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A placeholder block that stands in for content still loading.
 *
 * General-purpose: it knows nothing about what it replaces. Compose several
 * into the shape of the real layout, at the same size, so nothing jumps when
 * the content arrives.
 *
 * Two layers rather than one animated view, so `className` lands on a plain
 * View where NativeWind always applies it — any size, percentage widths
 * included — and the pulse lives on an inner fill clipped to its corners.
 *
 * Holds still when the OS "reduce motion" setting is on, and is hidden from
 * screen readers: the screen using it announces the loading state once,
 * rather than every block announcing nothing.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  const theme = useColorScheme() ?? "light";
  const isReducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isReducedMotion) return;

    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(opacity);
  }, [isReducedMotion, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      className={`overflow-hidden ${className ?? ""}`}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Colors[theme].inputBackground },
          pulseStyle,
        ]}
      />
    </View>
  );
}
