import { ExerciseLogSchema } from "@/types/types"; // path doğruysa sıkıntı yok
import React from "react";
import { Text } from "react-native";
import { z } from "zod";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

type GetSetCardProps = {
  exercise: ExerciseLog;
  index?: number; // Optional index for styling or display purposes
};

export default function GetSetCard({ exercise, index }: GetSetCardProps) {
  return (
    <ThemedView className="flex-row items-center justify-between w-full shadow-md shadow-gray-900 p-3 rounded-lg mb-3">
      <Text className="text-sm text-gray-500 mr-5">{index! + 1}.</Text>
      <ThemedText className="text-xl font-bold mb-2">
        {exercise.activity}
      </ThemedText>

      <ThemedView className="space-y-1">
        {exercise.sets.map((set, index) => (
          <ThemedText key={index} className="text-sm">
            • {set.setType} – {set.value ?? "?"}{" "}
            {set.reps ? `x ${set.reps}` : ""}
          </ThemedText>
        ))}
      </ThemedView>
    </ThemedView>
  );
}
