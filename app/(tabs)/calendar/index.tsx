import ExerciseLogByDate from "@/components/calendar/ExerciseLogByDate";
import { Colors } from "@/constants/Colors";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
import { ExerciseLogSchema } from "@/types/types";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

export default function CalendarScreen() {
  const today = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const theme = useColorScheme() ?? "light";
  const { handleQueryError } = useServerErrorHandler();

  // TODO: make this useeffect work
  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
  } = trpc.fitness.getExerciseLogsByMonth.useQuery({
    month: visibleMonth,
  }) as {
    data: { logs: ExerciseLog[]; uniqueDates: string[] };
    isLoading: boolean;
    error: any;
  };

  const {
    data: labels,
    isLoading: labelsLoading,
    error: labelsError,
  } = trpc.label.getAllLabelsFromMonth.useQuery({
    date: visibleMonth,
  }) as {
    data: { date: string; label: string }[] | undefined;
    isLoading: boolean;
    error: any;
  };

  useEffect(() => {
    if (logsError) {
      handleQueryError(logsError);
    } else if (labelsError) {
      handleQueryError(labelsError);
    }
  }, [logsError, labelsError, handleQueryError]);

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
        <ScrollView>
          <Calendar
            key={theme}
            // Initially visible month
            current={visibleMonth}
            // Handler which gets executed on day press
            /*  onDayPress={(day) => {
              setSelectedDate(day.dateString);
            }} */
            onMonthChange={(month) => {
              const newMonth = `${month.year}-${String(month.month).padStart(2, "0")}`;
              setVisibleMonth(newMonth);
            }}
            dayComponent={({ date, state }) => {
              if (!date) return null;
              const label = labels?.find(
                (log) => log.date === date.dateString
              )?.label;
              const isMarked = logs?.uniqueDates.includes(date.dateString);
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
            // Mark specific dates

            // markedDates={{
            //   ...logs?.uniqueDates.reduce(
            //     (acc, date) => {
            //       acc[date] = {
            //         selected: true,
            //         selectedColor: Colors[theme].calendarMarker,
            //       };
            //       if (date === today) {
            //         acc[date] = {
            //           selected: true,
            //           selectedColor: Colors[theme].calendarMarker,
            //           marked: true,
            //           dotColor: Colors[theme].cardBackground,
            //         };
            //       }
            //       return acc;
            //     },
            //     {} as Record<string, MarkingProps>
            //   ),

            //   /* [today]: {
            //     marked: true,
            //     dotColor: Colors[theme].cardBackground,
            //   }, */

            //   /* "2025-08-07": { marked: true },
            // "2025-08-08": { disabled: true }, */
            // }}

            // Theme customization
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
