import ExerciseLogByDate from "@/components/ExerciseLogByDate";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc";
import { ExerciseLogSchema } from "@/types/types";
import React, { useEffect, useState } from "react";
import { ScrollView, useColorScheme, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { MarkingProps } from "react-native-calendars/src/calendar/day/marking";
import { z } from "zod";

export default function CalendarScreen() {
  const today = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const theme = useColorScheme() ?? "light";
  // TODO: make this useeffect work
  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

  const { data } = trpc.fitness.getExerciseLogsByMonth.useQuery({
    month: visibleMonth,
  }) as {
    data: { logs: ExerciseLog[]; uniqueDates: string[] };
  };
  return (
    <>
      <View className="flex-1">
        <ScrollView>
          <Calendar
            key={theme}
            // Initially visible month
            current={today}
            // Handler which gets executed on day press
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
            }}
            onMonthChange={(month) => {
              const newMonth = `${month.year}-${String(month.month).padStart(2, "0")}`;
              setVisibleMonth(newMonth);
            }}
            // Mark specific dates
            markedDates={{
              ...data?.uniqueDates.reduce(
                (acc, date) => {
                  acc[date] = {
                    selected: true,
                    selectedColor: Colors[theme].calendarMarker,
                  };
                  if (date === today) {
                    acc[date] = {
                      selected: true,
                      selectedColor: Colors[theme].calendarMarker,
                      marked: true,
                      dotColor: Colors[theme].cardBackground,
                    };
                  }
                  return acc;
                },
                {} as Record<string, MarkingProps>
              ),

              /* [today]: {
                marked: true,
                dotColor: Colors[theme].cardBackground,
              }, */

              /* "2025-08-07": { marked: true },
            "2025-08-08": { disabled: true }, */
            }}
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
                "stylesheet.day.basic": {
                  selected: {
                    backgroundColor: "green",
                    borderRadius: 8, // less than half = rounded square
                  },
                },
              } as any
            }
          />

          <ExerciseLogByDate selectedDate={selectedDate} />
        </ScrollView>
      </View>
    </>
  );
}
