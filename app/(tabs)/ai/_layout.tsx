import { Stack } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useChatContext } from "@/context/ChatContext";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  useColorScheme,
} from "react-native";

export default function AIStackLayout() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const { clearChat } = useChatContext();
  return (
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
        className="px-4 py-3 justify-between items-center flex-row"
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
        <RoundedButton icon="radio" onPress={clearChat} />
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
