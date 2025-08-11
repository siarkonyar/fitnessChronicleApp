import { Stack } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { View, useColorScheme } from "react-native";

export default function CalendarStackLayout() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 flex-col bg-transparent">
      {/* Fixed left header */}
      {/* <BlurView intensity={50} tint={"dark"}>
        <View className="px-4 py-3">
          <ThemedText type="title">Calendar</ThemedText>
        </View>
      </BlurView> */}

      <View
        className="px-4 py-3"
        style={{
          paddingTop: insets.top,
          backgroundColor: Colors[theme].highlight,
        }}
      >
        <ThemedText
          lightColor={Colors.light.cardBackground}
          darkColor={Colors.dark.cardBackground}
          type="title"
        >
          Settings
        </ThemedText>
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
