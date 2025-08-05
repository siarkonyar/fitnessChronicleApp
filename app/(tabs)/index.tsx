import { ThemedText } from "@/components/ThemedText";
import { trpc } from "@/lib/trpc"; // Adjust the import path as necessary
import { Button } from "@react-navigation/elements";
import { router } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const getLog = trpc.fitness.getExerciseLogByDate.useQuery({
    date: new Date().toISOString(), // veya istediğin tarih
  });

  const handleNavigateToExercise = () => {
    router.push("/(screens)/logExercise");
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center">
      {getLog! ? (
        <>
          <ThemedText className="text-lg text-center">
            Seems like you haven&apos;t started working out yet. It&apos;s the
            perfect time to start your first exercise! 🏋️
          </ThemedText>
          <Button onPress={handleNavigateToExercise} className="mt-4">
            Log Exercise
          </Button>
        </>
      ) : (
        <ScrollView>
          <Button onPress={handleNavigateToExercise} className="mt-4">
            Log Exercise
          </Button>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
