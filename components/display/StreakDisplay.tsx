import TextPill from "@/components/TextPill";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getStreak } from "@/lib/firebase/streaks";
import { FontAwesome6 } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useColorScheme, View } from "react-native";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

export default function StreakDisplay() {
  const theme = useColorScheme() ?? "dark";
  const { handleQueryError } = useServerErrorHandler();
  const user = useAuth();

  const userId = user.user?.uid;

  const { data: streakValue = 0, error } = useQuery({
    queryKey: queryKeys.streak.all,
    queryFn: () => getStreak(), // getStreak expects 0 args
    enabled: !!userId,
  });

  if (error) handleQueryError(error);

  const clampedValue = Math.min(Math.max(streakValue, 0), 4);

  const renderDots = () => {
    return Array.from({ length: 4 }, (_, index) => {
      const isLit = index < clampedValue;

      return (
        <FontAwesome6
          key={`streak-dot-${index}`}
          name={isLit ? "bolt" : "circle"}
          size={isLit ? 28 : 20}
          color={isLit ? Colors[theme].highlight : Colors[theme].mutedText}
        />
      );
    });
  };

  return (
    <Card className="gap-4">
      <ThemedView className="flex-row items-center justify-between">
        <ThemedView>
          <ThemedText type="label">STREAK</ThemedText>
          <ThemedText type="subtitle" className="mt-1">
            Keep it going
          </ThemedText>
        </ThemedView>

        <TextPill text={`${streakValue} week${streakValue === 1 ? "" : "s"}`} />
      </ThemedView>

      <ThemedView className="flex-row items-center justify-between rounded-2xl px-3 py-4">
        <View className="flex-1 flex-row items-center justify-between">
          {renderDots()}
        </View>
      </ThemedView>
    </Card>
  );
}
