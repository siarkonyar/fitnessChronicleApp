import GetSetCard from "@/components/exercise/GetSetCard";
import { ThemedText } from "@/components/ThemedText";
import { trpc } from "@/lib/trpc"; // Adjust the import path as necessary
import { ExerciseLogSchema } from "@/types/types"; // Adjust the import path as necessary
import { Button } from "@react-navigation/elements";
import { router } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

export default function HomeScreen() {
  type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
  const { data: logs, isLoading } = trpc.fitness.getExerciseLogByDate.useQuery({
    date: new Date().toISOString().split("T")[0],
  }) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
  };

  console.log(logs, "today", new Date().toISOString().split("T")[0]);

  const handleNavigateToExercise = () => {
    router.push("/(screens)/logExercise");
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <ThemedText className="text-lg">Loading...</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center">
      {logs! ? (
        <ScrollView className="w-full p-4">
          <ThemedText type="title" className="mb-4">
            Todays Exercise Log
          </ThemedText>
          {logs.map((log, index) => (
            <GetSetCard key={log.date} exercise={log} index={index} />
          ))}
          <Button onPress={handleNavigateToExercise} className="mt-4">
            Log Exercise
          </Button>
        </ScrollView>
      ) : (
        <>
          <ThemedText className="text-lg text-center">
            Seems like you haven&apos;t started working out yet. It&apos;s the
            perfect time to start your first exercise! 🏋️
          </ThemedText>
          <Button onPress={handleNavigateToExercise} className="mt-4">
            Log Exercise
          </Button>
        </>
      )}
    </SafeAreaView>
  );
}
