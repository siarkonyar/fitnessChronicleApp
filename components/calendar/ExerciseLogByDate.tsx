import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc";
import { ExerciseLogSchema } from "@/types/types";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import DateEmojiAssignment from "./DateEmojiAssignment";

// Helper function to format date as "20th of August"
const formatDateAsString = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });

  // Add ordinal suffix to day
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${day}${getOrdinalSuffix(day)} of ${month}`;
};

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

  let emptyDay = (
    <ThemedView className="flex-1 justify-center items-center pt-8">
      <ThemedText className="text-xl font-semibold text-center leading-relaxed">
        No exercise logs found for {"\n"}
        {formatDateAsString(selectedDate)}.{" "}
      </ThemedText>
    </ThemedView>
  );

  // Get today's date in yyyy-mm-dd format
  const today = new Date().toLocaleDateString("en-CA");

  // Compare and switch
  switch (true) {
    case selectedDate === today:
      emptyDay = (
        <ThemedView className="px-6 rounded-xl max-w-md mx-auto">
          <ThemedText className="text-xl font-semibold text-center leading-relaxed">
            You haven&apos;t started your workout yet. Ready to{" "}
            <ThemedText className="font-bold">crush</ThemedText> it today?{"\n"}{" "}
            <ThemedText className="text-2xl">🚀💪</ThemedText>
          </ThemedText>

          <ThemedView className="items-center mt-4">
            <Button
              onPress={() => {
                router.push("/(screens)/logExercise");
              }}
            >
              Log Exercise
            </Button>
          </ThemedView>
        </ThemedView>
      );
      break;
    case selectedDate < today:
      emptyDay = (
        <ThemedView className="px-6 rounded-xl max-w-md mx-auto">
          <ThemedText className="text-xl font-semibold text-center leading-relaxed">
            Seems like it was a
            <ThemedText className="font-bold"> rest day</ThemedText>. {"\n"} The
            perfect time to{" "}
            <ThemedText className="font-bold">recharge </ThemedText>
            and get ready for your next workout!{" "}
            <ThemedText className="text-2xl">🛌💪</ThemedText>
          </ThemedText>
        </ThemedView>
      );
      break;
    case selectedDate > today:
      emptyDay = (
        <ThemedView className="px-6 rounded-xl max-w-md mx-auto">
          <ThemedText className="text-xl font-semibold text-center leading-relaxed">
            Your workout is waiting.{"\n"}
            <ThemedText className="font-bold">Prepare</ThemedText> to make it
            count!{"\n"}
            <ThemedText className="text-2xl">💪✨</ThemedText>
          </ThemedText>
        </ThemedView>
      );
      break;
  }

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
      <ThemedView className="flex-1 justify-center items-center my-8">
        <ThemedText type="title" className="mb-8 text-center">
          {selectedDate === today ? "Today" : formatDateAsString(selectedDate)}
        </ThemedText>

        <DateEmojiAssignment selectedDate={selectedDate} />
        <ThemedText type="subtitle" className="my-8 text-center">
          Exercise Log
        </ThemedText>

        {logs && logs.length > 0 ? (
          <ThemedView className="w-full p-4">
            {[...logs]
              .sort((a, b) => {
                // Access the createdAt object (you might still need 'as any' here if your frontend types don't match)
                const createdAtA = (a as any).createdAt;
                const createdAtB = (b as any).createdAt;

                // Convert each Firestore Timestamp object into a single comparable millisecond value
                // (seconds * 1000 for milliseconds + nanoseconds / 1,000,000 for milliseconds)
                const timeValueA =
                  createdAtA._seconds * 1000 +
                  createdAtA._nanoseconds / 1_000_000;
                const timeValueB =
                  createdAtB._seconds * 1000 +
                  createdAtB._nanoseconds / 1_000_000;

                // Subtracting the values directly sorts them from oldest to newest
                return timeValueA - timeValueB;
              })
              .map((log, index) => (
                <GetExerciseCard key={index} exercise={log} index={index} />
              ))}
          </ThemedView>
        ) : (
          <>{emptyDay}</>
        )}
      </ThemedView>
    </>
  );
}
