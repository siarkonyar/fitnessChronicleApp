import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { View } from "react-native";

export default function CalendarStackLayout() {
  return (
    <SafeAreaView className="flex-1 flex-col bg-transparent">
      {/* Fixed left header */}
      {/* <BlurView intensity={50} tint={"dark"}>
        <View className="px-4 py-3">
          <ThemedText type="title">Calendar</ThemedText>
        </View>
      </BlurView> */}

      <View className="px-4 py-3">
        <ThemedText type="title">Calendar</ThemedText>
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaView>
  );
}
