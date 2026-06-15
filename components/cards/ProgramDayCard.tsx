import Card from "@/components/Card";
import MiniExerciseCard from "@/components/exercise/MiniExerciseCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import IconBadge from "@/components/ui/IconBadge";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ProgramDaySchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity } from "react-native";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;

interface ProgramDayCardProps {
  index: number;
  day: ProgramDay;
  onPress?: (index: number) => void;
  isSelected?: boolean;
  className?: string;
}

export default function ProgramDayCard({
  index,
  day,
  onPress,
  isSelected,
  className,
}: ProgramDayCardProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];

  const exerciseCount = day.exercises?.length ?? 0;
  const dayTitle = day.isRestDay
    ? "Rest day"
    : (day.label?.description ?? day.label?.label ?? "Workout day");

  return (
    <Card
      className={className}
      style={{
        backgroundColor: palette.cardBackground,
        borderColor: isSelected ? palette.highlight : palette.cardBorderColor,
      }}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.7 : 1}
        onPress={() => onPress?.(index)}
        disabled={!onPress}
      >
        <ThemedView className="flex-row items-center w-full">
          <IconBadge className="mr-4">
            {day.isRestDay ? (
              <Feather name="moon" size={22} color={palette.secondary} />
            ) : (
              <ThemedText className="text-2xl font-bold">
                {day.label?.label ?? "?"}
              </ThemedText>
            )}
          </IconBadge>
          <ThemedView className="flex-col flex-1 min-w-0">
            <ThemedText
              className="text-xs font-bold tracking-widest"
              style={{ color: palette.highlight }}
            >
              DAY {index + 1}
            </ThemedText>
            <ThemedText className="text-base font-semibold" numberOfLines={1}>
              {dayTitle}
            </ThemedText>
          </ThemedView>
          {day.isRestDay ? (
            <ThemedView
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${palette.secondary}18`,
                borderWidth: 1,
                borderColor: `${palette.secondary}30`,
              }}
            >
              <Feather name="moon" size={12} color={palette.secondary} />
              <ThemedText
                className="text-xs font-semibold"
                style={{ color: palette.secondary }}
              >
                Rest
              </ThemedText>
            </ThemedView>
          ) : (
            exerciseCount > 0 && (
              <ThemedView
                className="px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${palette.highlight}18`,
                  borderWidth: 1,
                  borderColor: `${palette.highlight}30`,
                }}
              >
                <ThemedText
                  className="text-xs font-semibold"
                  style={{ color: palette.highlight }}
                >
                  {exerciseCount}{" "}
                  {exerciseCount === 1 ? "exercise" : "exercises"}
                </ThemedText>
              </ThemedView>
            )
          )}
        </ThemedView>

        {!day.isRestDay &&
          (exerciseCount > 0 ? (
            <ThemedView
              className="mt-3 pt-3 border-t"
              style={{ borderTopColor: palette.separator }}
            >
              {(day.exercises ?? []).map((exercise, exerciseIndex) => (
                <MiniExerciseCard
                  key={exerciseIndex}
                  exercise={exercise}
                  variant="program"
                />
              ))}
            </ThemedView>
          ) : (
            <ThemedView
              className="flex-row items-center mt-3 pt-3 border-t"
              style={{ borderTopColor: palette.separator }}
            >
              <Feather name="info" size={14} color={palette.mutedText} />
              <ThemedText
                className="ml-2"
                lightColor={Colors.light.mutedText}
                darkColor={Colors.dark.mutedText}
              >
                No exercises yet
              </ThemedText>
            </ThemedView>
          ))}
      </TouchableOpacity>
    </Card>
  );
}
