import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme, View } from "react-native";

/**
 * The standing warning above the composer.
 *
 * Deliberately NOT part of the empty state. That block only renders while
 * messages.length === 0, so it disappears the moment someone starts talking —
 * which is exactly when a warning about the answers is worth reading. This sits
 * above the composer instead, where it stays visible for every turn of every
 * conversation.
 *
 * Three claims, in the order that matters:
 *
 *  - Beta, so expectations start low.
 *  - It can be wrong. The deflection in the system prompt is an instruction to
 *    a model, not a guarantee about its output, and nothing in the code checks
 *    what comes back.
 *  - Not medical or professional advice. The prompt tells the coach to send
 *    injury and pain questions to a doctor, but that only fires if the model
 *    obeys, and only inside the conversation. This says it regardless.
 *
 * Kept short on purpose: a paragraph here would be scrolled past, and a warning
 * nobody reads is decoration.
 */
const DISCLAIMER =
  "Beta — the coach can be wrong. Nothing it says is medical or professional advice.";

export default function CoachDisclaimer() {
  const theme = useColorScheme() ?? "light";

  return (
    <View className="px-6 pb-1 pt-1">
      <ThemedText
        className="text-center text-xs leading-4"
        style={{ color: Colors[theme].mutedText }}
      >
        {DISCLAIMER}
      </ThemedText>
    </View>
  );
}
