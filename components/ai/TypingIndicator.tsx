import { Colors } from "@/constants/Colors";
import React from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";

/**
 * Shaped to match a model-side ChatBubble so the real reply swaps in
 * without the surrounding layout shifting.
 */
export default function TypingIndicator() {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="mb-3 self-start rounded-3xl px-5 py-4"
      style={{
        backgroundColor: Colors[theme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[theme].cardBorderColor,
      }}
    >
      <ActivityIndicator size="small" color={Colors[theme].highlight} />
    </View>
  );
}
