import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ProgramDaySchema } from "@/types/types";
import React from "react";
import { View } from "react-native";
import { z } from "zod";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import MutedCard from "./MuteCard";

type ProgramDay = z.infer<typeof ProgramDaySchema>;

interface AddProgramDayCardProps {
  index: number;
  day: ProgramDay;
  onPress?: () => void;
  className?: string;
}

export default function AddProgramDayCard({
  index,
  day,
  onPress,
  className,
}: AddProgramDayCardProps) {
  const theme = useColorScheme() ?? "light";

  const exerciseCount = day.exercises?.length ?? 0;
  const subtitle = day.isRestDay
    ? "Rest Day"
    : day.label?.description
      ? day.label.description
      : exerciseCount > 0
        ? `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}`
        : "No exercises";

  return (
    <MutedCard
      onPress={onPress}
      className={`${className ?? ""} items-center justify-between`}
    >
      <ThemedView className="flex-row items-center flex-1 min-w-0">
        <View
          className="w-14 h-14 rounded-2xl mr-4 justify-center items-center"
          style={{
            backgroundColor: `${Colors[theme].highlight}18`,
            borderWidth: 1,
            borderColor: `${Colors[theme].highlight}30`,
          }}
        >
          <ThemedText
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: Colors[theme].highlight,
            }}
          >
            {index + 1}
          </ThemedText>
        </View>
        <ThemedView className="flex-col flex-1 min-w-0">
          <ThemedText className="text-base font-semibold">
            Day {index + 1}
          </ThemedText>
          <ThemedText
            className="text-sm"
            lightColor={Colors.light.mutedText}
            darkColor={Colors.dark.mutedText}
          >
            {subtitle}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </MutedCard>
  );
}
