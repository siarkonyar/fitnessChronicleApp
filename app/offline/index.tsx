import { Button } from "@/components/Button";
import MyIcon from "@/components/LogoIcon";
import { Colors } from "@/constants/Colors";
import {
  getOfflineExerciseLogsByDate,
  OfflineExerciseLog,
} from "@/lib/localStorage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GetExerciseCard from "../../components/exercise/GetExerciseCard";
import { ThemedText } from "../../components/ThemedText";
import { useConnectivity } from "../../context/ConnectivityContext";

export default function OfflineScreen() {
  const { refresh } = useConnectivity();
  const { isOnline, connectivityLoading } = useConnectivity();
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const [offlineLogs, setOfflineLogs] = useState<OfflineExerciseLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    loadOfflineLogs();
  }, []);

  const loadOfflineLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await getOfflineExerciseLogsByDate(today);
      setOfflineLogs(logs);
    } catch (error) {
      console.error("Failed to load offline logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRefresh = async () => {
    await refresh();
    if (isOnline) {
      router.push("/(tabs)");
    }
  };

  const handleLogExercise = () => {
    router.push("/offline/logExercise" as any);
  };

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
      <ScrollView className="w-full px-4 py-6">
        <ThemedText type="subtitle" className="mb-4 text-center">
          Offline Mode - Today&apos;s Exercise Logs
        </ThemedText>

        <Button onPress={handleLogExercise} className="mt-4 mb-8">
          + Log New Exercise
        </Button>

        {isLoadingLogs ? (
          <ThemedText className="text-center text-gray-500 mb-4">
            Loading offline logs...
          </ThemedText>
        ) : offlineLogs.length > 0 ? (
          <View className="mb-6">
            <ThemedText type="subtitle" className="mb-3 text-center">
              Offline Exercise Logs ({offlineLogs.length})
            </ThemedText>
            {offlineLogs.map((log, index) => (
              <GetExerciseCard
                key={log.id}
                exercise={log}
                index={index}
                deletable={true}
                isOffline={true}
              />
            ))}
          </View>
        ) : (
          <View className="mb-6">
            <ThemedText className="text-center text-gray-500 mb-4">
              No offline exercise logs for today
            </ThemedText>
            <ThemedText className="text-center text-sm text-gray-400">
              Log your first exercise while offline!
            </ThemedText>
          </View>
        )}

        <Button
          onPress={handleRefresh}
          type="primary"
          disabled={connectivityLoading}
          className="mt-4"
        >
          {connectivityLoading
            ? "Refreshing..."
            : "Check Connection & Go Online"}
        </Button>

        <ThemedText className="text-center text-xs text-gray-400 mt-4">
          Your offline exercise logs will be synced when you&apos;re back online
        </ThemedText>
      </ScrollView>
    </>
  );
}
