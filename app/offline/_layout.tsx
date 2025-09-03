import { Stack } from "expo-router";
import React from "react";

export default function OfflineLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
        headerLargeTitle: false,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerLargeTitleShadowVisible: false,
        headerBackVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{}} />
    </Stack>
  );
}
