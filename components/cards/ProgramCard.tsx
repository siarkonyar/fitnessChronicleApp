import Card from "@/components/Card";
import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import IconBadge from "@/components/ui/IconBadge";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import MiniExerciseCard from "@/components/exercise/MiniExerciseCard";
import { ProgramWithIdSchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { LayoutAnimation, TouchableOpacity } from "react-native";
import { z } from "zod";

type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

interface ProgramCardProps {
  program: ProgramWithId;
  onPress?: (programId: string) => void;
  onDelete?: (programId: string) => void;
  className?: string;
}

export default function ProgramCard({
  program,
  onPress,
  onDelete,
  className,
}: ProgramCardProps) {
  const theme = useColorScheme() ?? "light";
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  const totalDays = program.days.length;
  const restDayCount = program.days.filter((day) => day.isRestDay).length;
  const exerciseCount = program.days.reduce(
    (sum, day) => sum + (day.exercises?.length ?? 0),
    0,
  );

  const subtitle =
    totalDays === 0
      ? "No days yet"
      : `${totalDays} day${totalDays !== 1 ? "s" : ""}${
          restDayCount > 0 ? ` · ${restDayCount} rest` : ""
        } · ${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}`;

  return (
    <Card className={className}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.7 : 1}
        onPress={() => onPress?.(program.id)}
        disabled={!onPress}
      >
        <ThemedView className="flex-row items-center w-full">
          <ThemedView className="flex-row items-center flex-1 min-w-0">
            <IconBadge className="mr-4">
              <Feather
                name="calendar"
                size={22}
                color={Colors[theme].highlight}
              />
            </IconBadge>
            <ThemedView className="flex-col flex-1 min-w-0">
              <ThemedText className="text-base font-semibold" numberOfLines={1}>
                {program.name.toUpperCase()}
              </ThemedText>
              <ThemedText
                lightColor={Colors.light.mutedText}
                darkColor={Colors.dark.mutedText}
                style={{ fontSize: 13 }}
              >
                {subtitle}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          {onDelete && (
            <RoundedButton
              type="danger"
              icon="trash-2"
              onPress={() => onDelete(program.id)}
            />
          )}
        </ThemedView>

        {totalDays > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleToggleExpand}
            className="flex-row items-center mt-3 pt-3 border-t"
            style={{ borderTopColor: Colors[theme].separator }}
          >
            <ThemedView className="flex-row flex-wrap gap-2 flex-1 min-w-0">
              {program.days.map((day, index) =>
              day.isRestDay ? (
                <ThemedView
                  key={index}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{
                    backgroundColor: `${Colors[theme].secondary}18`,
                    borderWidth: 1,
                    borderColor: `${Colors[theme].secondary}30`,
                  }}
                >
                  <Feather
                    name="moon"
                    size={13}
                    color={Colors[theme].secondary}
                  />
                </ThemedView>
              ) : (
                <ThemedView
                  key={index}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{
                    backgroundColor: `${Colors[theme].highlight}18`,
                    borderWidth: 1,
                    borderColor: `${Colors[theme].highlight}30`,
                  }}
                >
                  <ThemedText className="text-xs font-bold">
                    {day.label?.label ?? "?"}
                  </ThemedText>
                </ThemedView>
              ),
              )}
            </ThemedView>
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Colors[theme].mutedText}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}

        {isExpanded && totalDays > 0 && (
          <ThemedView
            className="mt-3 pt-3 border-t"
            style={{ borderTopColor: Colors[theme].separator }}
          >
            {program.days.map((day, index) => (
              <Card
                key={index}
                className={index === totalDays - 1 ? "mb-0" : ""}
                style={{ backgroundColor: Colors[theme].cardBackground }}
              >
                <ThemedView
                  className={`flex-row items-center ${
                    day.isRestDay ? "" : "mb-3"
                  }`}
                >
                  <ThemedText
                    className="text-xs font-bold"
                    style={{ color: Colors[theme].highlight }}
                  >
                    DAY {index + 1}
                  </ThemedText>
                  {day.isRestDay ? (
                    <ThemedView className="flex-row items-center ml-2">
                      <Feather
                        name="moon"
                        size={12}
                        color={Colors[theme].secondary}
                      />
                      <ThemedText
                        className="text-sm ml-1"
                        lightColor={Colors.light.mutedText}
                        darkColor={Colors.dark.mutedText}
                      >
                        Rest day
                      </ThemedText>
                    </ThemedView>
                  ) : (
                    <ThemedView className="flex-row items-center flex-1 min-w-0 ml-2">
                      <ThemedText className="text-sm font-semibold">
                        {day.label?.label ?? "?"}
                      </ThemedText>
                      {day.label?.description && (
                        <ThemedText
                          className="text-sm ml-2"
                          numberOfLines={1}
                          lightColor={Colors.light.mutedText}
                          darkColor={Colors.dark.mutedText}
                        >
                          {day.label.description}
                        </ThemedText>
                      )}
                    </ThemedView>
                  )}
                </ThemedView>

                {!day.isRestDay &&
                  (day.exercises && day.exercises.length > 0 ? (
                    day.exercises.map((exercise, exerciseIndex) => (
                      <MiniExerciseCard
                        key={exerciseIndex}
                        exercise={exercise}
                        variant="program"
                      />
                    ))
                  ) : (
                    <ThemedText
                      className="text-xs"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                    >
                      No exercises yet
                    </ThemedText>
                  ))}
              </Card>
            ))}
          </ThemedView>
        )}
      </TouchableOpacity>
    </Card>
  );
}
