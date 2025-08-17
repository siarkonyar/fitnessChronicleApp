import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc"; // Adjust the import path as necessary
import { ExerciseLogWithIdSchema } from "@/types/types"; // Adjust the import path as necessary
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { z } from "zod";

export default function HomeScreen() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;
  const { data: logs, isLoading } = trpc.fitness.getExerciseLogByDate.useQuery({
    date: new Date().toLocaleDateString("en-CA"),
  }) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
  };

  const handleNavigateToExercise = () => {
    router.push("/(screens)/logExercise");
  };

  if (isLoading) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center"
      >
        <ActivityIndicator
          size="large"
          color={Colors[theme].highlight}
          className="mb-4"
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <View
        className="px-4 pb-3"
        style={{
          paddingTop: insets.top,
        }}
      >
        <View className="flex-row items-center">
          <MyIcon size={32} color={Colors[theme].highlight} />
          <ThemedText
            lightColor={Colors[theme].highlight}
            darkColor={Colors[theme].highlight}
            type="title"
            className="ml-1"
          >
            ercule
          </ThemedText>
        </View>
      </View>

      {logs && logs.length > 0 ? (
        <ScrollView className="w-full px-4 py-6">
          <ThemedText type="subtitle" className="mb-4 text-center">
            Todays Exercise Log
          </ThemedText>
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
            .map(
              (log, index) => (
                console.log(log.createdAt),
                (<GetExerciseCard key={index} exercise={log} index={index} />)
              )
            )}

          <Button onPress={handleNavigateToExercise} className="mt-4 mb-8">
            Log Exercise
          </Button>
        </ScrollView>
      ) : (
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-6">
            <ThemedText className="text-xl font-semibold text-center mb-2">
              🏋️ Ready to Get Moving?
            </ThemedText>
            <ThemedText className="text-base text-center text-gray-600 leading-relaxed">
              Seems like you haven&apos;t started working out yet. It&apos;s the
              perfect time to start your first exercise!
            </ThemedText>
          </View>

          <View className="items-center">
            <Button onPress={handleNavigateToExercise}>Log Exercise</Button>
          </View>
        </View>
      )}
    </>
  );
}
