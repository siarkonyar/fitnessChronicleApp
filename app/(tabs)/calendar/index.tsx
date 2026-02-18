import ExerciseLogByDate from "@/components/calendar/ExerciseLogByDate";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getExerciseLogsByMonth } from "@/lib/firebase/exercise";
import { getAllLabelsFromMonth } from "@/lib/firebase/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const today = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const [refreshing, setRefreshing] = useState(false);
  const theme = useColorScheme() ?? "light";
  const { handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  // TODO: make this useeffect work
  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  const {
    data: exerciseData,
    isLoading: logsLoading,
    error: logsError,
  } = useQuery({
    queryKey: queryKeys.exerciseLogs.byMonth(visibleMonth),
    queryFn: () => getExerciseLogsByMonth(visibleMonth),
  });

  const exerciseUniqueDates = exerciseData?.uniqueDates;

  const {
    data: labels, // 👈 Direkt labels olarak al (array döndürüyor)
    isLoading: labelsLoading,
    error: labelsError,
  } = useQuery({
    queryKey: queryKeys.labelAssignments.byMonth(visibleMonth),
    queryFn: () => getAllLabelsFromMonth(visibleMonth),
  });

  useEffect(() => {
    if (logsError) {
      handleQueryError(logsError);
    } else if (labelsError) {
      handleQueryError(labelsError);
    }
  }, [logsError, labelsError, handleQueryError]);

  const onRefresh = () => {
    setRefreshing(true);
    queryClient.invalidateQueries({
      queryKey: queryKeys.exerciseLogs.byMonth(visibleMonth),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.labelAssignments.byMonth(visibleMonth),
    });
    setTimeout(() => setRefreshing(false), 1500);
  };

  if (logsLoading || labelsLoading) {
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
      <View className="flex-1">
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors[theme].highlight]}
              tintColor={Colors[theme].highlight}
            />
          }
        >
          <Calendar
            key={theme}
            current={visibleMonth}
            onMonthChange={(month) => {
              const newMonth = `${month.year}-${String(month.month).padStart(2, "0")}`;
              setVisibleMonth(newMonth);
            }}
            dayComponent={({ date, state }) => {
              if (!date) return null;

              const label = labels?.find(
                (log) => log.date === date.dateString,
              )?.label;

              const isMarked = exerciseUniqueDates?.includes(date.dateString);
              const isToday = date.dateString === today;
              const isSelectedDay = date.dateString === selectedDate;

              return (
                <TouchableOpacity
                  onPress={() => setSelectedDate(date.dateString)}
                  className="items-center justify-center h-11 w-11"
                  style={{
                    borderRadius: 8,
                    borderWidth: isSelectedDay ? 4 : 0,
                    borderColor: isSelectedDay
                      ? Colors[theme].separator
                      : "transparent",
                  }}
                >
                  <View
                    className="items-center justify-center h-9 w-9"
                    style={{
                      backgroundColor: isMarked
                        ? Colors[theme].calendarMarker
                        : "transparent",
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          state === "disabled"
                            ? Colors[theme].mutedText
                            : isMarked
                              ? Colors[theme].cardBackground
                              : isToday
                                ? Colors[theme].highlight
                                : Colors[theme].text,
                        fontSize: label ? 20 : 16,
                      }}
                    >
                      {label || date.day}
                    </Text>
                    {isToday && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: isMarked
                            ? Colors[theme].background
                            : Colors[theme].calendarMarker,
                          marginTop: 1,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            theme={
              {
                backgroundColor: Colors[theme].background,
                calendarBackground: Colors[theme].background,
                textSectionTitleColor: Colors[theme].text,
                selectedDayBackgroundColor: Colors[theme].tint,
                selectedDayTextColor: Colors[theme].cardBackground,
                todayTextColor: Colors[theme].highlight,
                dayTextColor: Colors[theme].text,
                textDisabledColor: Colors[theme].mutedText,
                arrowColor: Colors[theme].tint,
                monthTextColor: Colors[theme].text,
                indicatorColor: Colors[theme].tint,
                textDayFontFamily: "monospace",
                textMonthFontFamily: "monospace",
                textDayHeaderFontFamily: "monospace",
              } as any
            }
          />

          <ExerciseLogByDate selectedDate={selectedDate} />
        </ScrollView>
      </View>
    </>
  );
}
