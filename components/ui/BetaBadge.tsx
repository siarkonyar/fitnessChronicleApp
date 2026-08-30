import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BADGE_WIDTH = 50;
const SHEEN_WIDTH = 14;
const SHEEN_START_X = -SHEEN_WIDTH * 2;
const SWEEP_DURATION_MS = 850;
const SWEEP_DELAY_MS = 2200;

interface BetaBadgeProps {
  className?: string;
}

/**
 * Small glossy "BETA" pill with a sheen that sweeps across it on a loop.
 * Designed to sit on a `highlight` coloured surface (e.g. the AI header).
 */
export default function BetaBadge({ className }: BetaBadgeProps) {
  const theme = useColorScheme() ?? "light";
  const surface = Colors[theme].accentTeal;
  const sheenX = useSharedValue(SHEEN_START_X);

  useEffect(() => {
    sheenX.value = withRepeat(
      withDelay(
        SWEEP_DELAY_MS,
        withTiming(BADGE_WIDTH + SHEEN_WIDTH, {
          duration: SWEEP_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [sheenX]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheenX.value }, { rotate: "18deg" }],
  }));

  return (
    <View
      className={`overflow-hidden rounded-full justify-center items-center ${className ?? ""}`}
      style={{
        width: BADGE_WIDTH,
        borderWidth: 1,
        borderColor: `${surface}80`,
      }}
    >
      <LinearGradient
        colors={[`${surface}59`, `${surface}1F`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        className="absolute -top-2 -bottom-2"
        style={[
          { width: SHEEN_WIDTH, backgroundColor: `${surface}6E` },
          sheenStyle,
        ]}
      />

      <Text
        className="text-xs font-['Inter-Bold'] tracking-[1px] py-[3px]"
        style={{ color: surface }}
      >
        BETA
      </Text>
    </View>
  );
}
