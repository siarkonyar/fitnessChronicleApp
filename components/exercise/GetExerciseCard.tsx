import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { deleteOfflineExercise } from "@/lib/offlineStorage";
import { trpc } from "@/lib/trpc";
import { ExerciseLogWithIdSchema } from "@/types/types"; // path doğruysa sıkıntı yok
import { Feather } from "@expo/vector-icons";
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
  offline?: () => void;
};

export default function GetExerciseCard({
  exercise,
  index,
  deletable,
  offline,
}: GetExerciseCardProps) {
  const theme = useColorScheme() ?? "light";
  const { handleMutationError } = useServerErrorHandler();
  const deleteExerciseNameMutation = trpc.fitness.deleteExerciseLog.useMutation(
    {
      onError: (error) => {
        handleMutationError(error);
      },
    }
  );
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
            if (offline) {
              await deleteOfflineExercise(exercise.id);
              offline?.(); // Notify parent component to refresh
              return;
            }
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
    <TouchableOpacity activeOpacity={1} className="w-full">
      <Card className="shadow-md shadow-gray-900 p-3 rounded-lg mb-3 relative">
        {deletable && (
          <TouchableOpacity
            onPress={handleDeletion}
            className="absolute top-2 right-2 z-10 items-center justify-center"
          >
            <Text className="text-red-600">Delete</Text>
          </TouchableOpacity>
        )}
        <ThemedView className="absolute top-2 left-2 z-10 items-center justify-center">
          <Text className="text-sm text-gray-500">{index! + 1}.</Text>
        </ThemedView>
        <ThemedView className="flex-col items-center justify-between w-full px-6 rounded-lg">
          <ThemedText className="text-xl font-bold shrink">
            {exercise.activity.toUpperCase()}
          </ThemedText>
          <ThemedView className="w-full flex-row items-start">
            <ThemedView className="flex-col">
              {exercise.sets.map((set, index) => {
                // Calculate display index - only count normal sets
                const displayIndex =
                  exercise.sets
                    .slice(0, index + 1)
                    .filter((s) => s.setType === "normal").length - 1;

                // Display logic based on set type
                const setDisplay =
                  set.setType === "normal"
                    ? `${displayIndex + 1}.`
                    : set.setType === "warmup"
                      ? "Warmup"
                      : set.setType === "failure"
                        ? "Failure"
                        : set.setType === "drop"
                          ? "Drop"
                          : set.setType === "pr"
                            ? "PR"
                            : set.setType === "failedpr"
                              ? "FPR"
                              : `${index + 1}.`;
                // Color logic aligned with AddSetCard
                const setColor =
                  set.setType === "warmup"
                    ? Colors[theme].secondary
                    : set.setType === "failure"
                      ? Colors[theme].highlight
                      : set.setType === "drop"
                        ? Colors[theme].accentBlue
                        : set.setType === "pr"
                          ? Colors[theme].success
                          : set.setType === "failedpr"
                            ? Colors[theme].danger
                            : undefined;

                return (
                  <ThemedView
                    key={index}
                    className="flex-row justify-between w-full border-b border-gray-300 dark:border-gray-700 mb-1 pb-1"
                  >
                    <ThemedText className="text-sm">
                      <Text style={{ color: setColor }}>{setDisplay}</Text>
                      {" set: "}
                    </ThemedText>
                    <ThemedText className="text-sm">
                      {set.value ?? "?"}
                      {set.measure}{" "}
                      <Feather name="x" size={12} color={Colors[theme].text} />{" "}
                      {"reps" in set ? (set.reps ?? "?") : "?"}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          </ThemedView>
        </ThemedView>
        {exercise.notes && exercise.notes.trim() ? (
          <ThemedText>{exercise.notes}</ThemedText>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}
