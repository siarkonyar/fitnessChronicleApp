import TextPill from "@/components/TextPill";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getStreak } from "@/lib/firebase/streaks";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { TouchableOpacity, useColorScheme } from "react-native";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

export default function WeightDisplay() {
  const theme = useColorScheme() ?? "dark";
  const { handleQueryError } = useServerErrorHandler();
  const user = useAuth();
  const [timeFrame, setTimeFrame] = useState<"month" | "year">("month");

  const handleMeasurementChange = (newTimeFrame: "month" | "year") => {
    setTimeFrame(newTimeFrame);
  };

  const userId = user.user?.uid;

  const { data, error } = useQuery({
    queryKey: queryKeys.streak.byUser(userId ?? ""),
    queryFn: () => getStreak(),
    enabled: !!userId,
  });

  if (error) handleQueryError(error);

  return (
    <Card className="gap-4">
      <ThemedView className="flex-row items-center justify-between">
        <ThemedView>
          <ThemedText className="text-xs uppercase tracking-[0.35em] opacity-60">
            STREAK
          </ThemedText>
          <ThemedText type="subtitle" className="mt-1">
            Keep it going
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView>
        <ThemedView className="mb-4">
          <ThemedView className="flex-row space-x-2">
            <TouchableOpacity
              key={1}
              activeOpacity={1}
              onPress={() => handleMeasurementChange("month")}
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 16,
                borderWidth: 2,
                borderColor: Colors[theme].highlight,
                borderTopLeftRadius: 8,
                borderBottomLeftRadius: 8,
                backgroundColor:
                  timeFrame === "month"
                    ? Colors[theme].highlight
                    : "transparent",
              }}
            >
              <ThemedText
                style={{
                  textAlign: "center",
                  fontWeight: "500",
                  fontSize: 12,
                  color:
                    timeFrame === "month"
                      ? Colors[theme].background
                      : Colors[theme].highlight,
                }}
              >
                Month
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              key={2}
              activeOpacity={1}
              onPress={() => handleMeasurementChange("year")}
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 16,
                borderWidth: 2,
                borderColor: Colors[theme].highlight,
                /* borderRightWidth: 0,
                    borderLeftWidth: 0, */
                borderTopRightRadius: 8,
                borderBottomRightRadius: 8,
                backgroundColor:
                  timeFrame === "year"
                    ? Colors[theme].highlight
                    : "transparent",
              }}
            >
              <ThemedText
                style={{
                  textAlign: "center",
                  fontWeight: "500",
                  fontSize: 12,
                  color:
                    timeFrame === "year"
                      ? Colors[theme].background
                      : Colors[theme].highlight,
                }}
              >
                Lbs
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </Card>
  );
}
