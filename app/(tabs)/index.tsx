import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { clearAllOfflineExercises, offlineData } from "@/lib/offlineStorage";
import { trpc } from "@/lib/trpc"; // Adjust the import path as necessary
import { ExerciseLogWithIdSchema } from "@/types/types"; // Adjust the import path as necessary
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  ActivityIndicator,
  RefreshControl,
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
  const { handleQueryError } = useServerErrorHandler();
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasAttemptedSync = useRef(false);
  const lastSyncAttempt = useRef<number>(0);

  // Function to reset sync state (can be called when user manually retries)
  const resetSyncState = () => {
    hasAttemptedSync.current = false;
    setIsSyncing(false);
    lastSyncAttempt.current = 0;
  };

  const syncMutation = trpc.fitness.syncOfflineExercises.useMutation({
    onError: (error) => {
      setIsSyncing(false);
    },
    onSuccess: () => {
      setIsSyncing(false);
    },
  });
  type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;
  const {
    data: logs,
    isLoading,
    error,
  } = trpc.fitness.getExerciseLogByDate.useQuery({
    date: new Date().toLocaleDateString("en-CA"),
  }) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
    error: any;
  };

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  useEffect(() => {
    const syncOfflineExercises = async () => {
      // Prevent multiple sync attempts within a short time window (5 seconds)
      const now = Date.now();
      if (
        isSyncing ||
        (hasAttemptedSync.current && now - lastSyncAttempt.current < 5000)
      ) {
        return;
      }

      try {
        const offlineDataString = await offlineData();
        if (offlineDataString && offlineDataString !== "[]") {
          hasAttemptedSync.current = true;
          lastSyncAttempt.current = now;
          setIsSyncing(true);

          const offlineExercises = JSON.parse(offlineDataString);

          // Transform offline exercises to match ExerciseLogSchema
          const exercises = offlineExercises.map((offlineExercise: any) => {
            const exercise: any = {
              date: offlineExercise.date,
              activity: offlineExercise.activity,
              sets: offlineExercise.sets,
            };

            // Only add optional fields if they exist
            if (offlineExercise.caloriesBurned !== undefined) {
              exercise.caloriesBurned = offlineExercise.caloriesBurned;
            }
            if (offlineExercise.notes !== undefined) {
              exercise.notes = offlineExercise.notes;
            }

            return exercise;
          });

          // Use tRPC to sync offline exercises to server
          await syncMutation.mutateAsync(exercises);
          await clearAllOfflineExercises();
        }
      } catch (error) {
        console.log(error);
        setIsSyncing(false);
      }
    };

    syncOfflineExercises();
  }, [syncMutation, isSyncing]);

  // Reset sync state when user navigates back to this screen (e.g., after retry)
  useFocusEffect(
    useCallback(() => {
      // Only reset sync state if we haven't attempted sync recently (within 10 seconds)
      const now = Date.now();
      if (!isSyncing && now - lastSyncAttempt.current > 10000) {
        resetSyncState();
      }
    }, [isSyncing])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
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
        <ScrollView
          className="w-full px-4 py-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors[theme].highlight]} // Android
              tintColor={Colors[theme].highlight} // iOS
            />
          }
        >
          <ThemedText type="subtitle" className="mb-4 text-center">
            Todays Exercise Log
          </ThemedText>
          {isSyncing && (
            <View className="mb-4 flex-row items-center justify-center">
              <ActivityIndicator
                size="small"
                color={Colors[theme].highlight}
                className="mr-2"
              />
              <ThemedText className="text-sm text-gray-600">
                Syncing offline exercises...
              </ThemedText>
            </View>
          )}
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
