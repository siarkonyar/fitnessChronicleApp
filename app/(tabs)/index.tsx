import { Button } from "@/components/Button";
import Card from "@/components/Card";
import TodayLabelCard from "@/components/cards/TodayLabelCard";
import StreakDisplay from "@/components/display/StreakDisplay";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  getExerciseLogByDate,
  syncOfflineExercises,
} from "@/lib/firebase/exercise";
import { clearAllOfflineExercises, offlineData } from "@/lib/offlineStorage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const today = new Date().toLocaleDateString("en-CA");
  const readableDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const insets = useSafeAreaInsets();
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasAttemptedSync = useRef(false);
  const lastSyncAttempt = useRef<number>(0);
  const queryClient = useQueryClient();

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

  const syncExercises = async () => {
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

  const syncExercisesCallBack = useCallback(syncExercises, [
    isSyncing,
    syncMutation,
  ]);

  useEffect(() => {
    syncExercisesCallBack();
  }, [syncExercisesCallBack]);

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
        style={{ backgroundColor: Colors[theme].background }}
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
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors[theme].background }}
    >
      <View className="px-4 pt-2">
        <View
          className="mb-2 flex-row items-center justify-between"
          style={{ paddingTop: insets.top > 0 ? 0 : 12 }}
        >
          <View className="flex-1 pr-4">
            <View className="flex-row items-center">
              <MyIcon size={48} color={Colors[theme].highlight} />
              <ThemedText
                lightColor={Colors[theme].highlight}
                darkColor={Colors[theme].highlight}
                type="title"
                className="ml-1 pt-1"
              >
                ercule
              </ThemedText>
            </View>
            <ThemedText className="mt-1 text-base opacity-70">
              {readableDate}
            </ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors[theme].highlight]}
            tintColor={Colors[theme].highlight}
          />
        }
      >
        <View className="px-4 pt-2">
          <Card>
            <View
              pointerEvents="none"
              className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10"
              style={{ backgroundColor: Colors[theme].highlight }}
            />
            <View
              pointerEvents="none"
              className="absolute -left-14 -bottom-14 h-32 w-32 rounded-full opacity-10"
              style={{ backgroundColor: Colors[theme].secondary }}
            />
            <ThemedText type="label">Training dashboard</ThemedText>
            <ThemedText type="subtitle" className="mt-2 mb-8">
              Log the work. Keep the rhythm.
            </ThemedText>
            {logs && logs.length > 0 ? (
              <ThemedView>
                {isSyncing && (
                  <View className="mb-4 flex-row items-center justify-center">
                    <ActivityIndicator
                      size="small"
                      color={Colors[theme].highlight}
                      className="mr-2"
                    />
                    <ThemedText className="text-sm opacity-70">
                      Syncing offline exercises...
                    </ThemedText>
                  </View>
                )}
                {logs
                  .sort(
                    (a, b) =>
                      (a.createdAt?.getTime() ?? 0) -
                      (b.createdAt?.getTime() ?? 0),
                  )
                  .map((log, index) => (
                    <GetExerciseCard
                      key={index}
                      exercise={log}
                      index={index}
                      deletable
                      editable
                    />
                  ))}
              </ThemedView>
            ) : (
              <></>
            )}
            <View className="mt-4 flex-row items-center gap-3">
              <View className="flex-1">
                <Button type="primary" onPress={handleNavigateToExercise}>
                  Log Exercise
                </Button>
              </View>
            </View>
          </Card>

          <TodayLabelCard />

          <StreakDisplay />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
