import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc";
import { ExerciseLogSchema } from "@/types/types";
import React from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { z } from "zod";
import DateEmojiAssignment from "./DateEmojiAssignment";

export default function ExerciseLogByDate({
  selectedDate,
}: {
  selectedDate: string;
}) {
  type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
  const theme = useColorScheme() ?? "light";

  const { data: logs, isLoading } = trpc.fitness.getExerciseLogByDate.useQuery({
    date: selectedDate,
  }) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
  };
  if (isLoading) {
    return (
      <ThemedView className="flex-1 justify-center items-center pt-8">
        <ActivityIndicator
          size="large"
          color={Colors[theme].highlight}
          className="mb-4"
        />
      </ThemedView>
    );
  }
  return (
    <>
      <ThemedView className="flex-1 justify-center items-center mt-8">
        <ThemedText type="subtitle" className="mb-4 text-center">
          Exercise Log for {selectedDate}
        </ThemedText>
        <DateEmojiAssignment selectedDate={selectedDate} />
        {logs && logs.length > 0 ? (
          <ThemedView className="w-full p-4">
            {logs?.map((log, index) => (
              <GetExerciseCard key={index} exercise={log} index={index} />
            ))}
          </ThemedView>
        ) : (
          <>
            <ThemedView className="p-6 rounded-xl max-w-md mx-auto">
              <ThemedText className="text-xl font-semibold text-center leading-relaxed">
                Seems like it was a{" "}
                <ThemedText className="font-bold">rest day</ThemedText>. The
                perfect time to{" "}
                <ThemedText className="font-bold">recharge</ThemedText>
                and get ready for your next workout!{" "}
                <ThemedText className="text-2xl">🛌💪</ThemedText>
              </ThemedText>
            </ThemedView>
          </>
        )}
      </ThemedView>
    </>
  );
}
