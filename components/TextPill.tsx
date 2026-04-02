import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

type TextPillProps = {
  text: string;
};

export default function TextPill({ text }: TextPillProps) {
  const theme = useColorScheme() ?? "dark";

  return (
    <ThemedView
      className="rounded-full px-3 py-1"
      style={{ backgroundColor: `${Colors[theme].highlight}22` }}
    >
      <ThemedText
        className="font-semibold"
        lightColor={Colors[theme].highlight}
        darkColor={Colors[theme].highlight}
      >
        {text}
      </ThemedText>
    </ThemedView>
  );
}
