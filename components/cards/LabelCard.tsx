import { router } from "expo-router";
import React from "react";
import { View } from "react-native";
import { z } from "zod";
import { LabelWithIdSchema } from "../../types/types";
import { ThemedText } from "../ThemedText";
import MutedCard from "./MuteCard";

interface LabelCardProps {
  index: number;
  label: z.infer<typeof LabelWithIdSchema>;
  onPress?: (labelId: string) => void;
  className?: string;
}

export default function LabelCard({
  index,
  label,
  onPress,
  className,
}: LabelCardProps) {
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
      className={className}
    >
      <View className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm justify-center items-center">
        <ThemedText
          className="leading-7"
          style={{ fontWeight: "bold", fontSize: 18 }}
        >
          {label.label}
        </ThemedText>
      </View>
      <ThemedText className="text-base font-medium">
        {label.description}
      </ThemedText>
    </MutedCard>
  );
}
