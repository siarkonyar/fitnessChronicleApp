import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { getWeights } from "@/lib/firebase/weight";
import { WeightWithIdSchema } from "@/types/types";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { TouchableOpacity, useColorScheme } from "react-native";
import { z } from "zod";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type WeightWithId = z.infer<typeof WeightWithIdSchema>;

function getFromDate(timeFrame: "month" | "year"): string {
  const today = getTodayString(); // YYYY-MM-DD
  const d = new Date(today);
  if (timeFrame === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toLocaleDateString("en-CA");
}

function WeightList({ logs }: { logs: WeightWithId[] }) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0)
    return <ThemedText className="opacity-60 text-sm">No data</ThemedText>;
  return (
    <ThemedView className="gap-1">
      {sorted.map((log) => (
        <ThemedView key={log.id} className="flex-row justify-between">
          <ThemedText className="text-sm opacity-60">{log.date}</ThemedText>
          <ThemedText className="text-sm">{log.weight} kg</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

export default function WeightDisplay() {
  const theme = useColorScheme() ?? "dark";
  const { handleQueryError } = useServerErrorHandler();
  const user = useAuth();
  const [timeFrame, setTimeFrame] = useState<"month" | "year">("month");

  const userId = user.user?.uid;

  const { data, error } = useQuery({
    queryKey: queryKeys.weightLogs.all,
    queryFn: () => getWeights(),
    enabled: !!userId,
  });

  if (error) handleQueryError(error);

  const fromDate = getFromDate(timeFrame);
  const today = getTodayString();
  const filtered = (data ?? []).filter(
    (log) => log.date >= fromDate && log.date <= today,
  );

  return (
    <Card className="gap-4">
      <ThemedView className="flex-row items-center justify-between">
        <ThemedView>
          <ThemedText className="text-xs uppercase tracking-[0.35em] opacity-60">
            WEIGHT
          </ThemedText>
          <ThemedText type="subtitle" className="mt-1">
            From {fromDate}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView className="mb-4">
        <ThemedView className="flex-row space-x-2 mb-4">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setTimeFrame("month")}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderWidth: 2,
              borderColor: Colors[theme].highlight,
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
              backgroundColor:
                timeFrame === "month" ? Colors[theme].highlight : "transparent",
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
            activeOpacity={1}
            onPress={() => setTimeFrame("year")}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderWidth: 2,
              borderColor: Colors[theme].highlight,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
              backgroundColor:
                timeFrame === "year" ? Colors[theme].highlight : "transparent",
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
              Year
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <WeightList logs={filtered} />
      </ThemedView>
    </Card>
  );
}
