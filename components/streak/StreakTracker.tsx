import { Colors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { useColorScheme } from "react-native";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

export default function StreakTracker() {
  const theme = useColorScheme() ?? "dark";
  return (
    <Card className="flex-row items-center justify-between">
      <MaterialCommunityIcons
        name="fire"
        size={96}
        color={Colors[theme].highlight}
        className="bg-white"
      />

      <ThemedView>
        <ThemedText>naebr</ThemedText>
      </ThemedView>
    </Card>
  );
}
