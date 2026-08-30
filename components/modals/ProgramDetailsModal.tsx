import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
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
import { useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { RoundedButton } from "../RoundButton";
import ProgramDayCard from "../cards/ProgramDayCard";

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

  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.875;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);
  const hasPresentedRef = useRef(false);

  // Bridge the controlled `visible` prop to the imperative sheet API.
  // Dismissing a sheet that was never presented strands it in a "dismissing"
  // state it can never leave, which silently swallows every later present().
  useEffect(() => {
    if (visible) {
      hasPresentedRef.current = true;
      bottomSheetModalRef.current?.present();
      return;
    }

    if (hasPresentedRef.current) {
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
      maxDynamicContentSize={maxDynamicContentSize}
      // This sheet is opened from inside another sheet (ChooseProgram). The
      // default "switch" behaviour minimizes that parent, which can unmount it
      // and take this sheet's portal down with it. "push" leaves it untouched.
      stackBehavior="push"
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
          program.days.map((day, index) => (
            <ProgramDayCard
              key={index}
              index={index}
              day={day}
              className={index === totalDays - 1 ? "mb-0" : ""}
            />
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
