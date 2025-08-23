import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { z } from "zod";
import { LabelWithIdSchema } from "../../types/types";
import { ThemedText } from "../ThemedText";
import MutedCard from "./MuteCard";

interface LabelCardProps {
  index: number;
  label: z.infer<typeof LabelWithIdSchema>;
  onPress?: (labelId: string) => void;
}

export default function LabelCard({ index, label, onPress }: LabelCardProps) {
  function handlePress() {
    if (onPress && label.id) {
      onPress(label.id);
    } else {
      router.push({
        pathname: "/(screens)/editLabel" as any,
        params: { id: label.id },
      });
    }
  }

  return (
    <MutedCard
      key={label.id ?? `${label.label}-${index}`}
      onPress={handlePress}
    >
      <View className="bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm">
        <Text className="text-2xl leading-7">{label.label}</Text>
      </View>
      <ThemedText className="flex-1 text-base font-medium">
        {label.description}
      </ThemedText>
    </MutedCard>
  );
}
