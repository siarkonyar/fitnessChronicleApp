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

  return (
    <>
      <Card>
        <ThemedText type="label" className="mb-3">
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
