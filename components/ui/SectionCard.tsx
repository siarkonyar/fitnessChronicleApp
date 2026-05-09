import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme, View } from "react-native";

export function SectionCard({ children }: { children: React.ReactNode }) {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="rounded-3xl overflow-hidden mb-1 border"
      style={{
        backgroundColor: Colors[theme].elevation,
        borderColor: Colors[theme].cardBorderColor,
        shadowColor:
          theme === "dark" ? Colors.dark.background : Colors[theme].highlight,
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {children}
    </View>
  );
}
