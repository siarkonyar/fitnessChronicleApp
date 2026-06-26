import ProgramDayCard from "@/components/cards/ProgramDayCard";
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
      maxDynamicContentSize={maxDynamicContentSize}
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
