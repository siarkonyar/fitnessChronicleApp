import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { InsideBottomSheetProvider } from "@/context/InsideBottomSheetContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getAllLabels } from "@/lib/firebase/label";
import {
  LabelSchema,
  LabelWithIdSchema,
  ProgramDaySchema,
  ProgramExerciseSchema,
} from "@/types/types";
import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import { z } from "zod";
import Card from "../Card";
import MiniExerciseCard from "../exercise/MiniExerciseCard";
import LabelList from "../lists/LabelList";
import AddProgramExerciseModal from "../modals/AddProgramExerciseModal";
import { RoundedButton } from "../RoundButton";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import IconBadge from "../ui/IconBadge";

type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
type Label = z.infer<typeof LabelSchema>;
type LabelWithId = z.infer<typeof LabelWithIdSchema>;

interface AddProgramDayCardProps {
  index: number;
  day: ProgramDay;
  onSelectLabel: (label: Label) => void;
  onAddExercise: (exercise: ProgramExercise) => void;
  onEditExercise: (exerciseIndex: number, exercise: ProgramExercise) => void;
  onDeleteExercise: (exerciseIndex: number) => void;
  onDeleteDay: (index: number) => void;
  className?: string;
}

export default function AddProgramDayCard({
  index,
  day,
  onSelectLabel,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onDeleteDay,
  className,
}: AddProgramDayCardProps) {
  const theme = useColorScheme() ?? "light";

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);

  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.85;

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

  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: labels } = useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: () => getAllLabels(),
  });

  const exerciseCount = day.exercises?.length ?? 0;
  const title = day.isRestDay
    ? "Rest Day"
    : day.label
      ? day.label.description
      : "Choose a label";
  const subtitle = day.isRestDay
    ? "Take a break"
    : exerciseCount > 0
      ? `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}`
      : "No exercises";

  function handleSelectLabel(labelId: string) {
    const found = (labels as LabelWithId[] | undefined)?.find(
      (item) => item.id === labelId,
    );
    if (!found) return;
    const { id, ...label } = found;
    onSelectLabel(label);
    bottomSheetModalRef.current?.dismiss();
  }

  function handleOpenEdit(exerciseIndex: number) {
    setEditingIndex(exerciseIndex);
    setIsAddExerciseOpen(true);
  }

  function handleCloseExerciseModal() {
    setIsAddExerciseOpen(false);
    setEditingIndex(null);
  }

  function handleSubmitExercise(exercise: ProgramExercise) {
    if (editingIndex !== null) {
      onEditExercise(editingIndex, exercise);
      return;
    }
    onAddExercise(exercise);
  }

  return (
    <>
      <Card className={className}>
        <ThemedView className="flex-row items-center w-full">
          <ThemedView className="flex-row items-center flex-1 min-w-0">
            {day.isRestDay ? (
              <ThemedView className="mr-4">
                <IconBadge>
                  <Feather
                    name="moon"
                    size={22}
                    color={Colors[theme].highlight}
                  />
                </IconBadge>
              </ThemedView>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => bottomSheetModalRef.current?.present()}
                className="mr-4"
              >
                <IconBadge>
                  {day.label ? (
                    <ThemedText style={{ fontSize: 24 }}>
                      {day.label.label}
                    </ThemedText>
                  ) : (
                    <Feather
                      name="plus"
                      size={22}
                      color={Colors[theme].highlight}
                    />
                  )}
                </IconBadge>
              </TouchableOpacity>
            )}
            <ThemedView className="flex-col flex-1 min-w-0">
              <ThemedText className="text-base font-semibold">
                {title}
              </ThemedText>
              <ThemedText
                lightColor={Colors.light.mutedText}
                darkColor={Colors.dark.mutedText}
              >
                {subtitle}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          <ThemedView>
            <RoundedButton
              type="danger"
              icon="x"
              onPress={() => onDeleteDay(index)}
            />
          </ThemedView>
        </ThemedView>

        {!day.isRestDay && exerciseCount > 0 && (
          <ThemedView
            className="mt-3 pt-3 border-t"
            style={{ borderTopColor: Colors[theme].separator }}
          >
            {day.exercises?.map((exercise, exerciseIndex) => (
              <ThemedView key={exerciseIndex} className="flex-row items-start gap-2">
                <MiniExerciseCard
                  exercise={exercise}
                  variant="program"
                  className="flex-1"
                />
                <RoundedButton
                  type="blue"
                  icon="edit-2"
                  onPress={() => handleOpenEdit(exerciseIndex)}
                />
                <RoundedButton
                  type="danger"
                  icon="trash-2"
                  onPress={() => onDeleteExercise(exerciseIndex)}
                />
              </ThemedView>
            ))}
          </ThemedView>
        )}

        {!day.isRestDay && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsAddExerciseOpen(true)}
            className={`flex-row items-center mt-3 pt-3 ${exerciseCount > 0 ? "" : "border-t"}`}
            style={
              exerciseCount > 0
                ? undefined
                : { borderTopColor: Colors[theme].separator }
            }
          >
            <Feather name="plus" size={16} color={Colors[theme].highlight} />
            <ThemedText
              className="font-medium ml-1"
              lightColor={Colors.light.highlight}
              darkColor={Colors.dark.highlight}
            >
              Add exercise
            </ThemedText>
          </TouchableOpacity>
        )}
      </Card>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        maxDynamicContentSize={maxDynamicContentSize}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: Colors[theme].background }}
        handleIndicatorStyle={{ backgroundColor: Colors[theme].separator }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <InsideBottomSheetProvider>
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center px-5 pb-4">
              <View className="flex-1 mr-3">
                <ThemedText className="text-xl font-bold" numberOfLines={1}>
                  Choose Label
                </ThemedText>
                <ThemedText
                  className="text-sm"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                  numberOfLines={1}
                >
                  Day {index + 1}
                </ThemedText>
              </View>
              <RoundedButton
                type="danger"
                icon="x"
                onPress={() => bottomSheetModalRef.current?.dismiss()}
              />
            </View>

            <ThemedView className="p-4">
              <LabelList labelOnPress={handleSelectLabel} />
            </ThemedView>
          </BottomSheetScrollView>
        </InsideBottomSheetProvider>
      </BottomSheetModal>

      <AddProgramExerciseModal
        visible={isAddExerciseOpen}
        dayIndex={index}
        initialExercise={
          editingIndex !== null ? day.exercises?.[editingIndex] : undefined
        }
        onClose={handleCloseExerciseModal}
        onAddExercise={handleSubmitExercise}
      />
    </>
  );
}
