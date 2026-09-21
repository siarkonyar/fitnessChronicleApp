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
const BORDER_ALPHA = "80";

type ColorToken = "mutedText" | "highlight" | "secondary";

interface TierConfig {
  label: string;
  accentToken: ColorToken;
}

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: { label: "FREE", accentToken: "mutedText" },
  pro: { label: "PRO", accentToken: "secondary" },
  max: { label: "MAX", accentToken: "highlight" },
};

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
        borderColor: `${accent}${BORDER_ALPHA}`,
      }}
    >
      <LinearGradient
        colors={[`${accent}59`, `${accent}1F`]}
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
