import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const BADGE_WIDTH = 50;

interface BetaBadgeProps {
  className?: string;
}

/**
 * Small glossy "BETA" pill.
 * Designed to sit on a `highlight` coloured surface (e.g. the AI header).
 */
export default function BetaBadge({ className }: BetaBadgeProps) {
  const theme = useColorScheme() ?? "light";
  const surface = Colors[theme].accentTeal;

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

      <Text
        className="text-xs font-['Inter-Bold'] tracking-[1px] py-[3px]"
        style={{ color: surface }}
      >
        BETA
      </Text>
    </View>
  );
}
