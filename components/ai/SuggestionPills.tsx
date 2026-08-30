import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import React from "react";
import { TouchableOpacity, useColorScheme, View } from "react-native";

const DISABLED_OPACITY = 0.4;

/** Hex alpha suffixes: a soft wash under a stronger outline of the same tint. */
const PILL_FILL_ALPHA = "26";
const PILL_BORDER_ALPHA = "80";

/**
 * Conversation starters for the empty chat — one per pillar the empty state
 * promises: programming, form/pain, nutrition.
 */
const SUGGESTIONS = [
  "Build me a 4-day workout program",
  "My shoulder hurts when I press. What should I do?",
  "How much protein do I need to build muscle?",
] as const;

type SuggestionPillsProps = {
  /** Called with the pill's text — the caller sends it as a chat message. */
  onSelect: (text: string) => void;
  disabled?: boolean;
};

export default function SuggestionPills({
  onSelect,
  disabled = false,
}: SuggestionPillsProps) {
  const theme = useColorScheme() ?? "light";
  const tint = Colors[theme].highlight;

  return (
    <View
      className="mt-6 w-full flex-row flex-wrap items-center justify-center gap-2"
      style={{ opacity: disabled ? DISABLED_OPACITY : 1 }}
    >
      {SUGGESTIONS.map((suggestion) => (
        <TouchableOpacity
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={suggestion}
          className="rounded-full border px-4 py-2.5 active:opacity-70"
          style={{
            backgroundColor: `${tint}${PILL_FILL_ALPHA}`,
            borderColor: `${tint}${PILL_BORDER_ALPHA}`,
          }}
        >
          <ThemedText
            className="text-xs font-semibold"
            lightColor={tint}
            darkColor={tint}
          >
            {suggestion}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
