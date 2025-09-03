import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useConnectivity } from "@/context/ConnectivityContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { syncOfflineLogs } from "@/lib/localStorage";
import { trpc } from "@/lib/trpc";
import { ExerciseLogWithIdSchema } from "@/types/types";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
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
  const { handleQueryError, handleMutationError } = useServerErrorHandler();
  const { isOnline } = useConnectivity();
  const lastSyncTime = useRef<number>(0);
  const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes between syncs

  type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;
  const {
    data: logs,
    isLoading,
    error,
  } = trpc.fitness.getExerciseLogByDate.useQuery(
    {
      date: new Date().toLocaleDateString("en-CA"),
    },
    {
      // Add better caching to reduce refetches
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  ) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
    error: any;
  };

  const utils = trpc.useUtils();
  const addExerciseLogMutation = trpc.fitness.addExerciseLog.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });

  // Handle query errors
  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  // Auto-sync offline logs when component mounts
  useEffect(() => {
    const autoSyncOfflineLogs = async () => {
      // Only sync if online and enough time has passed since last sync
      if (!isOnline) {
        console.log("Skipping sync - offline");
        return;
      }

      const now = Date.now();
      if (now - lastSyncTime.current < SYNC_COOLDOWN) {
        console.log("Skipping sync - cooldown period");
        return;
      }

      try {
        // Check if there are actually offline logs before attempting sync
        const { getOfflineExerciseLogs } = await import("@/lib/localStorage");
        const offlineLogs = await getOfflineExerciseLogs();

        if (offlineLogs.length === 0) {
          console.log("No offline logs to sync");
          return;
        }

        console.log(
          `Starting auto-sync of ${offlineLogs.length} offline logs...`
        );
        const { syncedCount, errorCount } = await syncOfflineLogs(
          addExerciseLogMutation.mutateAsync
        );

        if (syncedCount > 0 || errorCount > 0) {
          lastSyncTime.current = now;

          // Only invalidate if we actually synced something
          if (syncedCount > 0) {
            await utils.fitness.getExerciseLogByDate.invalidate({
              date: new Date().toLocaleDateString("en-CA"),
            });
          }

          if (errorCount > 0) {
            console.log(
              `Auto-sync completed: ${syncedCount} synced, ${errorCount} failed`
            );
          } else {
            console.log(`Auto-sync successful: ${syncedCount} logs synced`);
          }
        }
      } catch (error) {
        console.error("Failed to auto-sync offline logs:", error);
      }
    };

    autoSyncOfflineLogs();
  }, [isOnline, addExerciseLogMutation, utils.fitness.getExerciseLogByDate]);

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
            .map((log, index) => (
              <GetExerciseCard
                key={index}
                exercise={log}
                index={index}
                deletable
              />
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
