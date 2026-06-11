import Card from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import MiniExerciseCard from "@/components/exercise/MiniExerciseCard";
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
      <View className="flex-row items-center justify-between px-5 pb-4">
        <ThemedText className="text-xl font-bold flex-1 mr-3" numberOfLines={1}>
          {program.name.toUpperCase()}
        </ThemedText>
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      >
        {totalDays === 0 ? (
          <ThemedText
            lightColor={Colors.light.mutedText}
            darkColor={Colors.dark.mutedText}
          >
            No days yet
          </ThemedText>
        ) : (
          program.days.map((day, index) => (
            <Card
              key={index}
              className={index === totalDays - 1 ? "mb-0" : ""}
              style={{ backgroundColor: palette.cardBackground }}
            >
              <ThemedView
                className={`flex-row items-center ${
                  day.isRestDay ? "" : "mb-3"
                }`}
              >
                <ThemedText
                  className="font-bold"
                  style={{ color: palette.highlight }}
                >
                  DAY {index + 1}
                </ThemedText>
                {day.isRestDay ? (
                  <ThemedView className="flex-row items-center ml-2">
                    <Feather name="moon" size={12} color={palette.secondary} />
                    <ThemedText
                      className="ml-1"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                    >
                      Rest day
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView className="flex-row items-center flex-1 min-w-0 ml-2">
                    <ThemedText className="font-semibold">
                      {day.label?.label ?? "?"}
                    </ThemedText>
                    {day.label?.description && (
                      <ThemedText
                        className="ml-2"
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
                    lightColor={Colors.light.mutedText}
                    darkColor={Colors.dark.mutedText}
                  >
                    No exercises yet
                  </ThemedText>
                ))}
            </Card>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
