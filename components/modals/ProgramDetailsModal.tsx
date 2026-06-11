import Card from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import MiniExerciseCard from "@/components/exercise/MiniExerciseCard";
import IconBadge from "@/components/ui/IconBadge";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ProgramWithIdSchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { z } from "zod";

type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

interface ProgramDetailsModalProps {
  program: ProgramWithId;
  visible: boolean;
  onClose: () => void;
}

export default function ProgramDetailsModal({
  program,
  visible,
  onClose,
}: ProgramDetailsModalProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const totalDays = program.days.length;
  const restDayCount = program.days.filter((day) => day.isRestDay).length;
  const exerciseTotal = program.days.reduce(
    (sum, day) => sum + (day.exercises?.length ?? 0),
    0,
  );
  const subtitle =
    totalDays === 0
      ? "No days yet"
      : `${totalDays} day${totalDays !== 1 ? "s" : ""}${
          restDayCount > 0 ? ` · ${restDayCount} rest` : ""
        } · ${exerciseTotal} exercise${exerciseTotal !== 1 ? "s" : ""}`;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["85%"], []);

  useEffect(() => {
    if (visible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: palette.background }}
      handleIndicatorStyle={{ backgroundColor: palette.separator }}
    >
      <View className="flex-row items-start justify-between px-5 pb-4">
        <View className="flex-1 mr-3">
          <ThemedText className="text-xl font-bold" numberOfLines={1}>
            {program.name.toUpperCase()}
          </ThemedText>
          <ThemedText
            className="text-sm"
            lightColor={Colors.light.mutedText}
            darkColor={Colors.dark.mutedText}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.dismiss()}
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: palette.inputBackground }}
        >
          <Feather name="x" size={16} color={palette.mutedText} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
      >
        {totalDays === 0 ? (
          <ThemedView className="items-center py-8">
            <Feather name="calendar" size={32} color={palette.mutedText} />
            <ThemedText
              className="text-center text-base font-semibold mt-4"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
            >
              No days yet
            </ThemedText>
            <ThemedText
              className="text-center mt-1"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
            >
              Add days to this program to see them here.
            </ThemedText>
          </ThemedView>
        ) : (
          program.days.map((day, index) => {
            const exerciseCount = day.exercises?.length ?? 0;
            const dayTitle = day.isRestDay
              ? "Rest day"
              : (day.label?.description ?? day.label?.label ?? "Workout day");

            return (
              <Card
                key={index}
                className={index === totalDays - 1 ? "mb-0" : ""}
                style={{ backgroundColor: palette.cardBackground }}
              >
                <ThemedView className="flex-row items-center w-full">
                  <IconBadge className="mr-4">
                    {day.isRestDay ? (
                      <Feather
                        name="moon"
                        size={22}
                        color={palette.secondary}
                      />
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
                    <ThemedText
                      className="text-base font-semibold"
                      numberOfLines={1}
                    >
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
                      <Feather
                        name="moon"
                        size={12}
                        color={palette.secondary}
                      />
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
                      <Feather
                        name="info"
                        size={14}
                        color={palette.mutedText}
                      />
                      <ThemedText
                        className="ml-2"
                        lightColor={Colors.light.mutedText}
                        darkColor={Colors.dark.mutedText}
                      >
                        No exercises yet
                      </ThemedText>
                    </ThemedView>
                  ))}
              </Card>
            );
          })
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
