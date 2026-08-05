import { Stack } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  useColorScheme,
} from "react-native";

export default function AIStackLayout() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  return (
    // KeyboardAvoidingView measures its own frame relative to its parent, so it
    // has to sit above the header for the offset to come out right.
    // NativeWind has no className interop for it, hence the inline flex style.
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
          AI
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
    </KeyboardAvoidingView>
  );
}
