import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc"; // Adjust the import path as necessary
import { ExerciseLogSchema } from "@/types/types"; // Adjust the import path as necessary
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
  type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
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
          {logs.map((log, index) => (
            <GetExerciseCard key={index} exercise={log} index={index} />
          ))}
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
