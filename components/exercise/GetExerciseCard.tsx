import { trpc } from "@/lib/trpc";
import { ExerciseLogWithIdSchema } from "@/types/types"; // path doğruysa sıkıntı yok
import React from "react";
import { Alert, Text, TouchableOpacity } from "react-native";
import { z } from "zod";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;

type GetExerciseCardProps = {
  exercise: ExerciseLog;
  index?: number; // Optional index for styling or display purposes
  deletable?: boolean;
};

export default function GetExerciseCard({
  exercise,
  index,
  deletable,
}: GetExerciseCardProps) {
  const deleteExerciseNameMutation =
    trpc.fitness.deleteExerciseLog.useMutation();
  const utils = trpc.useUtils();

  const handleDeletion = async () => {
    Alert.alert(
      "Delete Exercise Log",
      "Are you sure you want to delete this exercise log?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExerciseNameMutation.mutateAsync({ id: exercise.id });
            await utils.fitness.getExerciseLogByDate.invalidate({
              date: exercise.date,
            });
            await utils.fitness.getExerciseLogsByMonth.invalidate({
              month: exercise.date.slice(0, 7),
            });
          },
        },
      ]
    );
  };
  return (
    <TouchableOpacity>
      <Card className="shadow-md shadow-gray-900 p-3 rounded-lg mb-3 relative">
        {deletable && (
          <TouchableOpacity
            onPress={handleDeletion}
            className="absolute top-2 right-2 z-10 items-center justify-center"
          >
            <Text className="text-red-600">Delete</Text>
          </TouchableOpacity>
        )}
        <ThemedView className="flex-row items-center justify-between w-full px-3 py-6 rounded-lg">
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
