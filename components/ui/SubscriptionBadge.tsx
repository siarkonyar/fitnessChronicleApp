import { Colors } from "@/constants/Colors";
import {
  TIER_BORDER_ALPHA,
  TIER_CONFIG,
  TIER_GRADIENT_ALPHA,
} from "@/constants/subscriptionTiers";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

const BADGE_WIDTH = 54;

interface SubscriptionBadgeProps {
  onPress?: () => void;
  className?: string;
}

/**
 * Rounded badge showing the user's subscription tier. One layout for all
 * three tiers — only the colour changes.
 *
 * Reads the tier itself, so call sites just render `<SubscriptionBadge />`.
 */
export default function SubscriptionBadge({
  onPress,
  className,
}: SubscriptionBadgeProps) {
  const theme = useColorScheme() ?? "light";
  const tier = useSubscriptionTier();
  const { label, accentToken } = TIER_CONFIG[tier];
  const accent = Colors[theme][accentToken];

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
        borderColor: `${accent}${TIER_BORDER_ALPHA}`,
      }}
    >
      <LinearGradient
        colors={[
          `${accent}${TIER_GRADIENT_ALPHA.start}`,
          `${accent}${TIER_GRADIENT_ALPHA.end}`,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Text
        className="text-xs font-['Inter-Bold'] tracking-[1px] py-[3px]"
        style={{ color: accent }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
