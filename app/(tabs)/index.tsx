import { Button } from "@/components/Button";
import Card from "@/components/Card";
import TodayLabelCard from "@/components/cards/TodayLabelCard";
import ChooseProgram from "@/components/ChooseProgram";
import ChooseProgramDay from "@/components/ChooseProgramDay";
import StreakDisplay from "@/components/display/StreakDisplay";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import MyIcon from "@/components/LogoIcon";
import ShareDayModal from "@/components/modals/ShareDayModal";
import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useActiveProgramContext } from "@/context/ActiveProgramContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { timestampToMillis } from "@/lib/dateUtils";
import { getExerciseLogByDate } from "@/lib/firebase/exercise";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const { handleQueryError } = useServerErrorHandler();
  const [refreshing, setRefreshing] = useState(false);
  const [shareDayVisible, setShareDayVisible] = useState(false);
  const { activeProgram } = useActiveProgramContext();

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
            <ThemedText className="text-sm opacity-70">
              {readableDate}
            </ThemedText>
          </View>
          <ChooseProgram />
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
          {activeProgram ? <ChooseProgramDay /> : null}

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
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <ThemedText type="label">Training dashboard</ThemedText>
                <ThemedText type="subtitle">
                  Log the work. Keep the rhythm.
                </ThemedText>
              </View>
              {logs && logs.length > 0 && (
                <RoundedButton
                  icon="upload"
                  onPress={() => setShareDayVisible(true)}
                />
              )}
            </View>
            {logs && logs.length > 0 ? (
              <ThemedView>
                {logs
                  .sort(
                    (a, b) =>
                      timestampToMillis(a.createdAt) -
                      timestampToMillis(b.createdAt),
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
      {logs && logs.length > 0 && (
        <ShareDayModal
          visible={shareDayVisible}
          onClose={() => setShareDayVisible(false)}
          logs={logs}
          date={today}
        />
      )}
    </SafeAreaView>
  );
}
