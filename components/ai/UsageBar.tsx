import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme, View } from "react-native";

interface UsageBarProps {
  /** 0-100, or null when the server hasn't told us yet. */
  percentUsed: number | null;
}

/**
 * Monthly AI allowance, as a grey track with a highlight fill on top.
 *
 * Renders nothing until the server has reported a figure — a bar that
 * defaulted to 0% would read as "you've used none", which is a different
 * claim from "we don't know yet".
 */
export default function UsageBar({ percentUsed }: UsageBarProps) {
  const theme = useColorScheme() ?? "light";

  if (percentUsed === null) return null;

  return (
    <View
      className="flex-row items-center gap-3 px-4 py-2"
      style={{ backgroundColor: Colors[theme].background }}
    >
      {/* The grey track. overflow-hidden is what clips the fill's square
          corners to the track's rounded ones. */}
      <View
        className="h-2 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: Colors[theme].inputBackground }}
      >
        <View
          className="h-full rounded-full"
          style={{
            width: `${percentUsed}%`,
            backgroundColor: Colors[theme].highlight,
          }}
        />
      </View>

      <ThemedText type="label" className="text-xs">
        {percentUsed}%
      </ThemedText>
    </View>
  );
}
