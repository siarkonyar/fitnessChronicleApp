import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { clearAllOfflineExercises, offlineData } from "@/lib/offlineStorage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  getExerciseLogByDate,
  syncOfflineExercises,
} from "@/lib/firebase/exercise";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function HomeScreen() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasAttemptedSync = useRef(false);
  const lastSyncAttempt = useRef<number>(0);
  const queryClient = useQueryClient();

  // Function to reset sync state (can be called when user manually retries)
  const resetSyncState = () => {
    hasAttemptedSync.current = false;
    setIsSyncing(false);
    lastSyncAttempt.current = 0;
  };

  const syncMutation = useMutation({
    mutationFn: syncOfflineExercises,
    onError: (error) => {
      setIsSyncing(false);
      handleMutationError(error);
    },
    onSuccess: () => {
      setIsSyncing(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byDate(
          new Date().toLocaleDateString("en-CA"),
        ),
      });
    },
  });
  const {
    data: logs,
    isLoading,
    error,
  } = useQuery({
    queryFn: () => getExerciseLogByDate(new Date().toLocaleDateString("en-CA")),
    queryKey: queryKeys.exerciseLogs.byDate(
      new Date().toLocaleDateString("en-CA"),
    ),
  });

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

            return exercise;
          });

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
    }, [isSyncing]),
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
        className="px-4 pb-3 flex-row justify-between"
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
            //style={{ fontWeight: "normal", fontFamily: "BebasNeue" }}
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
          {logs
            .sort(
              (a, b) =>
                (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
            )
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
              Ready to Get Moving?
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
