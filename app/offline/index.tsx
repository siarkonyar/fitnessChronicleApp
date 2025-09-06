import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useConnectivity } from "@/context/ConnectivityContext";
import { getOfflineExercises, OfflineExercise } from "@/lib/offlineStorage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Helper function to format date for display
const formatDateForDisplay = (dateString: string): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const exerciseDate = new Date(dateString);

  // Reset time to compare only dates
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const yesterdayDate = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate()
  );
  const exerciseDateOnly = new Date(
    exerciseDate.getFullYear(),
    exerciseDate.getMonth(),
    exerciseDate.getDate()
  );

  if (exerciseDateOnly.getTime() === todayDate.getTime()) {
    return "Today's Exercise Logs";
  } else if (exerciseDateOnly.getTime() === yesterdayDate.getTime()) {
    return "Yesterday's Exercise Logs";
  } else {
    // Format as "1st of August Exercise Logs"
    const day = exerciseDate.getDate();
    const month = exerciseDate.toLocaleString("default", { month: "long" });
    const daySuffix =
      day === 1 || day === 21 || day === 31
        ? "st"
        : day === 2 || day === 22
          ? "nd"
          : day === 3 || day === 23
            ? "rd"
            : "th";

    return `${day}${daySuffix} of ${month} Exercise Logs`;
  }
};

// Helper function to group exercises by date
const groupExercisesByDate = (
  exercises: OfflineExercise[]
): { [key: string]: OfflineExercise[] } => {
  return exercises.reduce(
    (groups, exercise) => {
      const date = exercise.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(exercise);
      return groups;
    },
    {} as { [key: string]: OfflineExercise[] }
  );
};

// This function will be defined inside the component to access the mutation

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const [logs, setLogs] = useState<OfflineExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { isOnline, refresh } = useConnectivity();

  useEffect(() => {
    loadOfflineExercises();
  }, []);

  // Auto-navigate to index when connectivity is restored
  useEffect(() => {
    if (isOnline && !retrying) {
      router.replace("/");
    }
  }, [isOnline, retrying]);

  const loadOfflineExercises = async () => {
    try {
      const exercises = await getOfflineExercises();
      setLogs(exercises);
    } catch (error) {
      console.error("Failed to load offline exercises:", error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadOfflineExercises();
    }, [])
  );

  // Handle retry connection
  const handleRetryConnection = async () => {
    setRetrying(true);
    try {
      // Refresh connectivity status
      refresh();

      // Wait for connectivity check to complete and check multiple times
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if we're online after refresh
        if (isOnline) {
          router.replace("/");
          return;
        }

        attempts++;
      }

      // If still offline after all attempts, show user feedback
      Alert.alert(
        "Connection Failed",
        "Unable to establish internet connection. Please check your network settings and try again.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Retry connection failed:", error);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
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
      <View className="flex-col justify-center px-4 my-4">
        <View className="items-center my-4">
          <ThemedText className="text-xl font-semibold text-center mb-2">
            📱 Offline Mode
          </ThemedText>
          <ThemedText className="text-base text-center text-gray-600 leading-relaxed">
            You&apos;re currently offline. Log your exercises here and
            they&apos;ll be automatically synced when you get back online.
          </ThemedText>
          <ThemedText className="text-base text-center text-gray-600 leading-relaxed">
            ({logs.length} logs)
          </ThemedText>
        </View>

        <View className="items-center">
          <Button
            onPress={() => {
              router.push("/offline/logExercise");
            }}
          >
            Log Exercise
          </Button>

          {/* TODO: make this a little reload button next to logo */}
          <Button
            type="primary"
            onPress={handleRetryConnection}
            disabled={retrying}
          >
            {retrying ? "Checking Connection..." : "Retry Connection"}
          </Button>
        </View>
      </View>
      {logs && logs.length > 0 ? (
        <ScrollView className="w-full px-4 py-6">
          {(() => {
            // Group exercises by date
            const groupedExercises = groupExercisesByDate(logs);

            // Sort dates in descending order (newest first)
            const sortedDates = Object.keys(groupedExercises).sort((a, b) => {
              return new Date(b).getTime() - new Date(a).getTime();
            });

            return sortedDates.map((date) => {
              const exercisesForDate = groupedExercises[date];

              // Sort exercises within each date by timestamp (newest first)
              const sortedExercises = exercisesForDate.sort((a, b) => {
                const timestampA = new Date(a.timestamp).getTime();
                const timestampB = new Date(b.timestamp).getTime();
                return timestampB - timestampA;
              });

              return (
                <View key={date} className="mb-6">
                  <ThemedText type="subtitle" className="mb-4 text-center">
                    {formatDateForDisplay(date)}
                  </ThemedText>

                  {sortedExercises.map((log, index) => (
                    <GetExerciseCard
                      key={log.id}
                      exercise={log}
                      index={index}
                      deletable
                      offline={loadOfflineExercises}
                    />
                  ))}
                </View>
              );
            });
          })()}
        </ScrollView>
      ) : (
        <ThemedText type="subtitle" className="mb-4 text-center">
          No offline exercise logs found
        </ThemedText>
      )}
    </>
  );
}
