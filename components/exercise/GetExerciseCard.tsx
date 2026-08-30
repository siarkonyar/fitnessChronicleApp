import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { logEvent } from "@/lib/analytics/client";
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
  index?: number;
  deletable?: boolean;
  editable?: boolean;
  copyable?: boolean;
  offline?: () => void;
};

export default function GetExerciseCard({
  exercise,
  index,
  deletable,
  editable,
  copyable,
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
      logEvent("exercise_deleted", {});

      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byDate(exercise.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byMonth(exercise.date.slice(0, 7)),
      });
    },
  });

  const handleCopy = () => {
    router.push({
      pathname: "/(screens)/logExercise",
      params: {
        copyActivity: exercise.activity,
        copySets: JSON.stringify(exercise.sets),
      },
    });
  };

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
    <TouchableOpacity
      activeOpacity={copyable ? 0.7 : 1}
      onPress={copyable ? handleCopy : undefined}
      className="w-full"
    >
      <Card type="exercise">
        <ThemedView className="flex-row z-10 items-center justify-between">
          <Text className="text-sm text-gray-500">{index! + 1}.</Text>
          <ThemedView className="z-10 flex-row items-center gap-3 m-0 p-0">
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
        </ThemedView>
        <ThemedView className="flex-col items-center justify-between w-full px-6 rounded-lg">
          <ThemedText className="text-lg font-bold shrink">
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
                    <ThemedText>
                      <Text style={{ color: setColor }}>{setDisplay}</Text>
                      {" set: "}
                    </ThemedText>
                    <ThemedText>
                      {set.value ? (
                        <>
                          {set.value}
                          {set.measure}{" "}
                          <Feather
                            name="x"
                            size={12}
                            color={Colors[theme].text}
                          />
                        </>
                      ) : (
                        ""
                      )}{" "}
                      {"reps" in set ? (set.reps ?? "?") : "?"} {"reps"}
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

        {copyable ? (
          <ThemedText
            className="text-center mt-2"
            lightColor={Colors.light.mutedText}
            darkColor={Colors.dark.mutedText}
          >
            Tap to copy
          </ThemedText>
        ) : (
          <ThemedText></ThemedText>
        )}
      </Card>
    </TouchableOpacity>
  );
}
