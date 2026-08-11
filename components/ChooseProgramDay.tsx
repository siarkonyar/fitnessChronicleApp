import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useActiveProgramContext } from "@/context/ActiveProgramContext";
import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useRef } from "react";
import {
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import Card from "./Card";
import ProgramDayCard from "./cards/ProgramDayCard";
import GetExerciseCard from "./exercise/GetExerciseCard";
import { RoundedButton } from "./RoundButton";
import IconBadge from "./ui/IconBadge";

export default function ChooseProgramDay() {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const { activeProgram, programDay, selectProgramDay } =
    useActiveProgramContext();

  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.85;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);

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

  function handleSelectDay(dayIndex: number) {
    selectProgramDay(dayIndex, {
      onSuccess: () => bottomSheetModalRef.current?.dismiss(),
    });
  }

  const currentDay =
    programDay !== undefined ? activeProgram?.days[programDay] : undefined;
  const currentExercises = currentDay?.exercises ?? [];
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <>
      <Card>
        <ThemedText type="label">program</ThemedText>
        <ThemedText type="subtitle" className="mb-4">
          Today&apos;s program
        </ThemedText>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => bottomSheetModalRef.current?.present()}
          className="flex-row items-center rounded-2xl p-3"
          style={{
            backgroundColor: `${palette.highlight}14`,
            borderWidth: 1,
            borderColor: `${palette.highlight}30`,
          }}
        >
          <IconBadge className="w-12 h-12 mr-3">
            {currentDay?.isRestDay ? (
              <Feather name="moon" size={28} color={palette.secondary} />
            ) : (
              <ThemedText className="text-3xl">
                {currentDay?.label?.label ?? "?"}
              </ThemedText>
            )}
          </IconBadge>

          <View className="flex-1 min-w-0">
            <ThemedText
              className="text-xs font-bold tracking-widest"
              style={{ color: palette.highlight }}
            >
              {programDay !== undefined ? `DAY ${programDay + 1}` : "NO DAY"}
            </ThemedText>
            <ThemedText className="font-bold" numberOfLines={1}>
              {currentDay?.isRestDay
                ? "Rest day"
                : (currentDay?.label?.description ?? "Choose a day")}
            </ThemedText>
            <ThemedText
              className="text-xs"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
              numberOfLines={1}
            >
              Tap to change
            </ThemedText>
          </View>

          <View
            className="w-8 h-8 rounded-full items-center justify-center ml-2"
            style={{ backgroundColor: `${palette.highlight}22` }}
          >
            <Feather name="chevron-right" size={16} color={palette.highlight} />
          </View>
        </TouchableOpacity>

        {currentDay && !currentDay.isRestDay && (
          <View className="mt-4">
            <View
              className="mb-4"
              style={{ height: 1, backgroundColor: palette.separator }}
            />

            <View className="flex-row items-center gap-2 mb-3">
              <Feather name="list" size={13} color={palette.mutedText} />
              <ThemedText className="uppercase tracking-[0.35em] opacity-60">
                Exercises
              </ThemedText>
            </View>

            {currentExercises.length > 0 ? (
              currentExercises.map((exercise, index) => (
                <GetExerciseCard
                  key={index}
                  exercise={{
                    ...exercise,
                    id: `program-${programDay}-${index}`,
                    date: today,
                  }}
                  index={index}
                  copyable
                />
              ))
            ) : (
              <View className="items-center py-4 gap-1">
                <ThemedText
                  className="opacity-50"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  No exercises in this day
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </Card>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        maxDynamicContentSize={maxDynamicContentSize}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.background }}
        handleIndicatorStyle={{ backgroundColor: palette.separator }}
      >
        <View className="flex-row items-center px-5 pb-4">
          <IconBadge className="mr-3">
            <Feather name="calendar" size={24} color={palette.highlight} />
          </IconBadge>
          <View className="flex-1 mr-3">
            <ThemedText className="text-xl font-bold" numberOfLines={1}>
              Pick a Day to Follow
            </ThemedText>
            <ThemedText
              className="text-sm uppercase"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
              numberOfLines={1}
            >
              {activeProgram?.name}
            </ThemedText>
          </View>
          <RoundedButton
            type="danger"
            icon="x"
            onPress={() => bottomSheetModalRef.current?.dismiss()}
          />
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        >
          {activeProgram?.days.map((day, index) => (
            <ProgramDayCard
              key={index}
              index={index}
              day={day}
              isSelected={index === programDay}
              onPress={handleSelectDay}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
