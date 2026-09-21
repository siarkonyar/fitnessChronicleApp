import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  SubscriptionTier,
  useSubscriptionTier,
} from "@/hooks/useSubscriptionTier";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

const BADGE_WIDTH = 54;

type TierColorToken = "mutedText" | "accentBlue" | "accentPurple";

interface TierConfig {
  label: string;
  token: TierColorToken;
}

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: { label: "FREE", token: "mutedText" },
  pro: { label: "PRO", token: "accentBlue" },
  max: { label: "MAX", token: "accentPurple" },
};

interface SubscriptionBadgeProps {
  onPress?: () => void;
  className?: string;
}

/**
 * Rounded badge showing the user's subscription tier. One layout for all
 * three tiers — only the colour token changes.
 *
 * Reads the tier itself, so call sites just render `<SubscriptionBadge />`.
 */
export default function SubscriptionBadge({
  onPress,
  className,
}: SubscriptionBadgeProps) {
  const theme = useColorScheme() ?? "light";
  const tier = useSubscriptionTier();
  const { label, token } = TIER_CONFIG[tier];
  const surface = Colors[theme][token];

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

      <Text
        className="text-xs font-['Inter-Bold'] tracking-[1px] py-[3px]"
        style={{ color: surface }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
