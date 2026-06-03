import DateLabelAssignment from "@/components/calendar/DateLabelAssignment";
import Card from "@/components/Card";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import TextPill from "@/components/TextPill";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { timestampToMillis } from "@/lib/dateUtils";
import {
  getLabelAsignmentByDate,
  getPrevExercisesFromLabel,
} from "@/lib/firebase/label";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";

export default function TodayLabelCard() {
  const theme = useColorScheme() ?? "light";
  const { handleQueryError } = useServerErrorHandler();

  const today = new Date().toLocaleDateString("en-CA");

  const { data: label, error: labelError } = useQuery({
    queryKey: queryKeys.labelAssignments.byDate(today),
    queryFn: () => getLabelAsignmentByDate(today),
  });

  const {
    data: prevExercises,
    isLoading: isPrevLoading,
    error: prevError,
  } = useQuery({
    queryKey: ["labels", "prevExercises", label?.id],
    queryFn: () => getPrevExercisesFromLabel(label!),
    enabled: !!label,
  });

  useEffect(() => {
    if (labelError) handleQueryError(labelError);
    if (prevError) handleQueryError(prevError);
  }, [labelError, prevError, handleQueryError]);

  return (
    <Card>
      <ThemedText type="label">Label</ThemedText>
      <ThemedText type="subtitle" className="mb-4">
        Today&apos;s label
      </ThemedText>
      <DateLabelAssignment
        selectedDate={today}
        buttonText="Assign Today's Label"
      />

      {label && (
        <View className="mt-4">
          <View
            className="mb-4"
            style={{
              height: 1,
              backgroundColor: Colors[theme].separator,
            }}
          />

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Feather name="clock" size={13} color={Colors[theme].mutedText} />
              <ThemedText className="text-xs uppercase tracking-[0.35em] opacity-60">
                Last Session
              </ThemedText>
            </View>
            {prevExercises && prevExercises.length > 0 && (
              <TextPill
                text={new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                }).format(new Date(prevExercises[0].date + "T00:00:00"))}
              />
            )}
          </View>

          {isPrevLoading ? (
            <ActivityIndicator
              size="small"
              color={Colors[theme].highlight}
              className="my-4"
            />
          ) : prevExercises && prevExercises.length > 0 ? (
            prevExercises
              .sort(
                (a, b) =>
                  timestampToMillis(a.createdAt) -
                  timestampToMillis(b.createdAt),
              )
              .map((exercise, index) => (
                <GetExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  copyable
                />
              ))
          ) : (
            <View className="items-center py-4 gap-1">
              <ThemedText
                className="text-sm opacity-50"
                lightColor={Colors.light.mutedText}
                darkColor={Colors.dark.mutedText}
              >
                No previous session yet.
              </ThemedText>
              <ThemedText
                className="text-xs opacity-40"
                lightColor={Colors.light.mutedText}
                darkColor={Colors.dark.mutedText}
              >
                Log exercises and they&apos;ll show up here next time.
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
