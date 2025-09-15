import { Button } from "@/components/Button";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useConnectivity } from "@/context/ConnectivityContext";
import { getOfflineExercises, OfflineExercise } from "@/lib/offlineStorage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useFocusEffect } from "expo-router";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const formatDateForDisplay = (dateString: string): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const exerciseDate = new Date(dateString);

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

const groupExercisesByDate = (
  exercises: OfflineExercise[]
): { [key: string]: OfflineExercise[] } => {
  return exercises.reduce(
    (groups, exercise) => {
      const date = exercise.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(exercise);
      return groups;
    },
    {} as { [key: string]: OfflineExercise[] }
  );
};

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const [logs, setLogs] = useState<OfflineExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { isOnline, refresh } = useConnectivity();

  // JS-driven spinner state
  const [rotation, setRotation] = useState(0);
  const spinRef = useRef<number | null>(null);

  const startSpin = () => {
    if (spinRef.current !== null) return;
    const step = () => {
      setRotation((prev) => (prev + 6) % 360);
      spinRef.current = requestAnimationFrame(step);
    };
    spinRef.current = requestAnimationFrame(step);
  };

  const stopSpin = () => {
    if (spinRef.current !== null) {
      cancelAnimationFrame(spinRef.current);
      spinRef.current = null;
    }
    setRotation(0);
  };

  useEffect(() => {
    loadOfflineExercises();
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      loadOfflineExercises();
    }, [])
  );

  const handleRetryConnection = async () => {
    setRetrying(true);
    startSpin();
    const minSpinMs = 900;
    const startTime = Date.now();

    try {
      refresh();
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (isOnline) {
          try {
            await Updates.reloadAsync();
          } catch (e) {
            console.error("Error reloading app:", e);
          }
          break;
        }
        attempts++;
      }

      if (!isOnline) {
        Alert.alert(
          "Connection Failed",
          "Unable to establish internet connection. Please check your network settings and try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Retry connection failed:", error);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minSpinMs - elapsed);
      if (remaining > 0)
        await new Promise((resolve) => setTimeout(resolve, remaining));
      setRetrying(false);
      stopSpin();
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
      <ThemedView
        className="px-4 pb-3 justify-between flex-row"
        style={{ paddingTop: insets.top }}
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
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!retrying) handleRetryConnection();
          }}
          disabled={retrying}
          className="ml-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{ transform: [{ rotate: `${rotation}deg` }] }}>
            <MaterialIcons
              name="refresh"
              size={24}
              color={Colors[theme].highlight}
            />
          </View>
        </Pressable>
      </ThemedView>

      <View className="flex-col justify-center px-4 my-4">
        <View className="items-center my-4">
          <ThemedText className="text-xl font-semibold text-center mb-2">
            📱 Offline Mode
          </ThemedText>
          <ThemedText className="text-base text-center text-gray-600 leading-relaxed">
            You&apos;re currently offline. Log your exercises here and
            they&apos;ll be automatically synced when you get back online.
          </ThemedText>
        </View>
        <View className="items-center justify-center">
          <Button onPress={() => router.push("/offline/logExercise")}>
            Log Exercise
          </Button>
        </View>
      </View>

      {logs.length > 0 ? (
        <ScrollView className="w-full px-4 py-6">
          {(() => {
            const grouped = groupExercisesByDate(logs);
            const sortedDates = Object.keys(grouped).sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            return sortedDates.map((date) => {
              const sortedExercises = grouped[date].sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              );
              return (
                <View key={date} className="mb-6">
                  <ThemedText type="subtitle" className="mb-4 text-center">
                    {formatDateForDisplay(date)}
                  </ThemedText>
                  {sortedExercises.map((log, idx) => (
                    <GetExerciseCard
                      key={log.id}
                      exercise={log}
                      index={idx}
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
        <ThemedView className="flex-1 justify-center px-6 h-full">
          <ThemedText type="subtitle" className="mb-4 text-center">
            No offline exercise logs found.
          </ThemedText>
        </ThemedView>
      )}
    </>
  );
}
