import { Stack } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import UsageBar from "@/components/ai/UsageBar";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useChatContext } from "@/context/ChatContext";
import { Feather } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  useColorScheme,
} from "react-native";

export default function AIStackLayout() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const { clearChat, percentUsed } = useChatContext();
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
        <View className="flex-row items-center">
          <MyIcon size={32} color={Colors[theme].cardBackground} />
          <ThemedText
            lightColor={Colors[theme].cardBackground}
            darkColor={Colors[theme].cardBackground}
            type="title"
            className="ml-1"
          >
            ercule AI
          </ThemedText>
        </View>
        <Pressable onPress={clearChat} className="p-2 active:opacity-70">
          <Feather
            name="refresh-cw"
            size={20}
            color={Colors[theme].cardBackground}
          />
        </Pressable>
      </View>
      <UsageBar percentUsed={percentUsed} />

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
