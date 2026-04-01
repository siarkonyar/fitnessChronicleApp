import { Colors } from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import React from "react";
import { useColorScheme, View } from "react-native";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

export default function StreakTracker() {
  const theme = useColorScheme() ?? "dark";

  const streakValue = 3;

  const renderDots = () => {
    const dots = [];
    const clampedValue = Math.min(Math.max(streakValue, 0), 4);

    for (let i = 0; i < 4; i++) {
      const isLit = i <= 4 - clampedValue;
      dots.push(
        <FontAwesome6
          name={`${isLit ? "bolt" : "circle"}`}
          size={isLit ? 64 : 48}
          color={Colors[theme].highlight}
        />,
      );
    }
    return dots;
  };

  return (
    <Card>
      <ThemedView className="items-center flex-row">
        <ThemedText type="subtitle">
          Streak{" "}
          <ThemedText
            type="subtitle"
            lightColor={Colors[theme].highlight}
            darkColor={Colors[theme].highlight}
          >
            {streakValue}
          </ThemedText>
        </ThemedText>
      </ThemedView>

      <ThemedView className="flex-col items-center gap-2">
        <View className="flex-row items-center">{renderDots()}</View>
      </ThemedView>
    </Card>
  );
}
