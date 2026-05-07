import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { deleteExerciseLog } from "@/lib/firebase/exercise";
import { deleteOfflineExercise } from "@/lib/offlineStorage";
import { ExerciseLogWithIdSchema } from "@/types/types"; // path doğruysa sıkıntı yok
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
  editable?: boolean;
  offline?: () => void;
};

export default function GetExerciseCard({
  exercise,
  index,
  deletable,
  editable,
  offline,
}: GetExerciseCardProps) {
  const theme = useColorScheme() ?? "light";
  const { handleMutationError } = useServerErrorHandler();
  const queryClient = useQueryClient();
  const deleteExerciseMutation = useMutation({
    mutationFn: deleteExerciseLog,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byDate(exercise.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byMonth(exercise.date.slice(0, 7)),
      });
    },
  });

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
            await deleteExerciseMutation.mutateAsync(exercise.id);
          },
        },
      ],
    );
  };
  return (
    <TouchableOpacity activeOpacity={1} className="w-full">
      <Card className="shadow-md shadow-gray-900 px-3 pb-6 pt-8 rounded-lg mb-3 relative">
        <ThemedView className="absolute top-0 right-2 z-10 flex-row items-center gap-3 m-0 p-0">
          {editable && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(screens)/editExercise",
                  params: { exerciseId: exercise.id },
                })
              }
            >
              <ThemedText
                darkColor={Colors.dark.success}
                lightColor={Colors.light.success}
              >
                Edit
              </ThemedText>
            </TouchableOpacity>
          )}
          {deletable && (
            <TouchableOpacity onPress={handleDeletion}>
              <ThemedText
                darkColor={Colors.dark.danger}
                lightColor={Colors.light.danger}
              >
                Delete
              </ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

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
