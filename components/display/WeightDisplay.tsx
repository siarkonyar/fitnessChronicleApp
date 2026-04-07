import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { getIfTodayLogged, getWeights } from "@/lib/firebase/weight";
import { WeightWithIdSchema } from "@/types/types";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { LineChart, lineDataItem } from "react-native-gifted-charts";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import WeightEntryModal from "../modals/WeightEntryModal";

type WeightWithId = z.infer<typeof WeightWithIdSchema>;

function getFromDate(timeFrame: "month" | "year"): string {
  const today = getTodayString(); // YYYY-MM-DD
  const d = new Date(today);
  if (timeFrame === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toLocaleDateString("en-CA");
}

function WeightList({ logs }: { logs: WeightWithId[] }) {
  const theme = useColorScheme() ?? "dark";
  const palette = Colors[theme];
  const [chartWidth, setChartWidth] = useState(0);
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0)
    return <ThemedText className="opacity-60">No data</ThemedText>;

  const minWeight = Math.min(...sorted.map((log) => log.weight));
  const maxWeight = Math.max(...sorted.map((log) => log.weight));
  const range = Math.max(maxWeight - minWeight, 1);
  const yAxisPadding = Math.max(Math.ceil(range * 0.2), 2);
  const stepSize = 2;
  const noOfSections = 4;
  const rawOffset = Math.max(Math.floor(minWeight - yAxisPadding), 0);
  const yAxisOffset = Math.floor(rawOffset / stepSize) * stepSize;
  const spacing =
    chartWidth > 0 && sorted.length > 1
      ? (chartWidth - 44) / sorted.length
      : 24;
  const initialSpacing = spacing / 2;

  const chartData: lineDataItem[] = sorted.map((log) => ({
    value: log.weight,
  }));

  return (
    <ThemedView
      className="mt-4"
      style={{ backgroundColor: palette.transparent }}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth > 0 && (
        <LineChart
          width={chartWidth - 44}
          isAnimated
          animateOnDataChange
          animationDuration={500}
          onDataChangeAnimationDuration={350}
          areaChart
          thickness={2.5}
          color={palette.highlight}
          data={chartData}
          noOfSections={noOfSections}
          stepValue={stepSize}
          yAxisOffset={yAxisOffset}
          maxValue={
            Math.ceil((maxWeight + yAxisPadding - yAxisOffset) / stepSize) *
            stepSize
          }
          yAxisTextStyle={{ color: palette.mutedText, fontSize: 11 }}
          yAxisColor={palette.cardBorderColor}
          xAxisColor={palette.cardBorderColor}
          hideDataPoints
          startFillColor={palette.highlight}
          endFillColor={palette.highlight}
          startOpacity={0.2}
          endOpacity={0.02}
          spacing={spacing}
          initialSpacing={initialSpacing}
          backgroundColor={palette.cardBackground}
          rulesColor={palette.cardBorderColor}
          rulesType="solid"
          xAxisLabelTextStyle={{ color: palette.mutedText, fontSize: 10 }}
          adjustToWidth
          yAxisLabelWidth={44}
          xAxisThickness={1}
          yAxisThickness={1}
        />
      )}
    </ThemedView>
  );
}

export default function WeightDisplay() {
  const theme = useColorScheme() ?? "dark";
  const { handleQueryError } = useServerErrorHandler();
  const user = useAuth();
  const [timeFrame, setTimeFrame] = useState<"month" | "year">("month");
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  const userId = user.user?.uid;

  const { data, error } = useQuery({
    queryKey: queryKeys.weightLogs.all,
    queryFn: () => getWeights(),
    enabled: !!userId,
  });

  const { data: ifTodayLogged, error: ifTodayLoggedError } = useQuery({
    queryKey: queryKeys.weightLogs.todayStatus(getTodayString()),
    queryFn: () => getIfTodayLogged(),
    enabled: !!userId,
  });

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
    if (ifTodayLoggedError) handleQueryError(ifTodayLoggedError);
  }, [error, ifTodayLoggedError, handleQueryError]);

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

        <Button
          type="primary"
          disabled={ifTodayLogged}
          onPress={() => setIsWeightModalOpen(true)}
          style={{ minHeight: 36, paddingVertical: 8, paddingHorizontal: 12 }}
          textStyle={{ fontSize: 12, lineHeight: 16 }}
        >
          Log Weight
        </Button>
      </ThemedView>

      <ThemedView className="">
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

      <Modal
        visible={isWeightModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWeightModalOpen(false)}
      >
        <KeyboardAvoidingView
          keyboardVerticalOffset={-90}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 items-center justify-center px-4 bg-black backdrop-blur-sm">
            <ThemedView className="w-11/12 max-w-md mx-4">
              <WeightEntryModal
                onLogged={() => setIsWeightModalOpen(false)}
                onCancel={() => setIsWeightModalOpen(false)}
              />
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Card>
  );
}
