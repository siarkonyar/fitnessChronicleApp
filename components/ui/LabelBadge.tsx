import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import React from "react";
import { View } from "react-native";

interface LabelBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export default function LabelBadge({ children, className }: LabelBadgeProps) {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className={`w-14 h-14 rounded-2xl justify-center items-center ${className ?? ""}`}
      style={{
        backgroundColor: `${Colors[theme].highlight}18`,
        borderWidth: 1,
        borderColor: `${Colors[theme].highlight}30`,
      }}
    >
      {children}
    </View>
  );
}
