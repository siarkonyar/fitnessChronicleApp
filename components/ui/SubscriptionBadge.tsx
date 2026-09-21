import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { SubscriptionTier } from "@/hooks/useSubscriptionTier";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BADGE_WIDTH = 54;
const SHEEN_WIDTH = 14;
const SHEEN_START_X = -SHEEN_WIDTH * 2;
const SWEEP_DURATION_MS = 850;
const SWEEP_DELAY_MS = 2200;

type TierColorToken = "mutedText" | "accentBlue" | "accentPurple";

interface TierConfig {
  label: string;
  token: TierColorToken;
  hasSheen: boolean;
}

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: { label: "FREE", token: "mutedText", hasSheen: false },
  pro: { label: "PRO", token: "accentBlue", hasSheen: true },
  max: { label: "MAX", token: "accentPurple", hasSheen: true },
};

interface SubscriptionBadgeProps {
  tier: SubscriptionTier;
  onPress?: () => void;
  className?: string;
}

/**
 * Rounded badge showing the user's subscription tier. One layout for all
 * three tiers — only the colour token changes. Paid tiers additionally get a
 * sheen that sweeps across the badge on a loop.
 */
export default function SubscriptionBadge({
  tier,
  onPress,
  className,
}: SubscriptionBadgeProps) {
  const theme = useColorScheme() ?? "light";
  const { label, token, hasSheen } = TIER_CONFIG[tier];
  const surface = Colors[theme][token];
  const sheenX = useSharedValue(SHEEN_START_X);

  useEffect(() => {
    if (!hasSheen) return;

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
  }, [hasSheen, sheenX]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheenX.value }, { rotate: "18deg" }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label} subscription`}
      className={`overflow-hidden rounded-xl justify-center items-center ${className ?? ""}`}
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

      {hasSheen && (
        <Animated.View
          className="absolute -top-2 -bottom-2"
          style={[
            { width: SHEEN_WIDTH, backgroundColor: `${surface}6E` },
            sheenStyle,
          ]}
        />
      )}

      <Text
        className="text-xs font-['Inter-Bold'] tracking-[1px] py-[3px]"
        style={{ color: surface }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
