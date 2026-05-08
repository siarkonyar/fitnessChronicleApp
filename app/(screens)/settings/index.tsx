import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React from "react";
import { ScrollView } from "react-native";

export default function Settings() {
  return (
    <ScrollView className="px-4 py-6">
      <ThemedView>
        <ThemedText type="defaultSemiBold">Settings</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}
