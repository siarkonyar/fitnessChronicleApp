import { ExerciseLogSchema } from "@/types/types"; // path doğruysa sıkıntı yok
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { z } from "zod";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

type GetExerciseCardProps = {
  exercise: ExerciseLog;
  index?: number; // Optional index for styling or display purposes
};

export default function GetExerciseCard({
  exercise,
  index,
}: GetExerciseCardProps) {
  return (
    <TouchableOpacity>
      <Card className="shadow-md shadow-gray-900 p-3 rounded-lg mb-3">
        <ThemedView className="flex-row items-center justify-between w-full p-3 rounded-lg">
          <ThemedView className="flex-row items-center flex-1 pr-4">
            <Text className="text-sm text-gray-500 mr-5">{index! + 1}.</Text>
            <ThemedText className="text-xl font-bold shrink">
              {exercise.activity.toUpperCase()}
            </ThemedText>
          </ThemedView>

          <ThemedView className="flex-col">
            {exercise.sets.map((set, index) => (
              <ThemedText key={index} className="text-sm">
                {index + 1}. {set.value ?? "?"}
                {set.setType} x {set.reps ?? "?"}
              </ThemedText>
            ))}
          </ThemedView>
        </ThemedView>
        {exercise.notes && exercise.notes.trim() ? (
          <ThemedText>{exercise.notes}</ThemedText>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}
