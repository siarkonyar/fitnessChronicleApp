import { Button } from "@/components/Button";
import ExerciseNameInput from "@/components/exercise/ExerciseNameInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { getDefaultMeasurement, getDefaultRepType } from "@/lib/offlineStorage";
import { ProgramExerciseSchema } from "@/types/types";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { AddSetCard } from "../exercise/AddSetCard";
import TextPill from "../TextPill";

type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;

type SetType = "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr";

interface AddProgramExerciseModalProps {
  visible: boolean;
  dayIndex: number;
  initialExercise?: ProgramExercise;
  onClose: () => void;
  onAddExercise: (exercise: ProgramExercise) => void;
}

export default function AddProgramExerciseModal({
  visible,
  dayIndex,
  initialExercise,
  onClose,
  onAddExercise,
}: AddProgramExerciseModalProps) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [sets, setSets] = useState<
    { id: number; reps: string; setType: SetType }[]
  >([]);
  const [isRepsFixed, setIsRepsFixed] = useState(false);
  const [measurement, setMeasurement] = useState<"kg" | "lbs">("kg");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getDefaultRepType().then(setIsRepsFixed);
    getDefaultMeasurement().then(setMeasurement);
  }, []);

  useEffect(() => {
    if (!visible || !initialExercise) return;

    setTitle(initialExercise.activity);
    setSets(
      initialExercise.sets.map((set, index) => ({
        id: Date.now() + index,
        reps: ("reps" in set ? set.reps : undefined) ?? "1",
        setType: set.setType as SetType,
      })),
    );
    const firstMeasure = initialExercise.sets[0]?.measure;
    if (firstMeasure === "kg" || firstMeasure === "lbs") {
      setMeasurement(firstMeasure);
    }
  }, [visible, initialExercise]);

  const addSet = () => {
    const newSet = {
      id: Date.now(),
      reps: "1",
      setType: "normal" as const,
    };
    setSets((prev) => [...prev, newSet]);
  };

  const removeSet = (id: number) => {
    Keyboard.dismiss();
    setSets((prev) => prev.filter((s) => s.id !== id));
  };

  const updateReps = (id: number, newReps: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, reps: newReps } : s)),
    );
  };

  const updateSetType = (id: number, newSetType: SetType) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, setType: newSetType } : s)),
    );
  };

  const copySet = (id: number) => {
    Keyboard.dismiss();
    setSets((prev) => {
      const setToCopy = prev.find((s) => s.id === id);
      if (!setToCopy) return prev;

      const newSet = { ...setToCopy, id: Date.now() };
      return [...prev, newSet];
    });
  };

  const resetForm = () => {
    setTitle("");
    setTitleError(false);
    setSets([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAdd = () => {
    if (title.trim().length < 3) {
      setTitleError(true);
      return;
    }

    if (sets.length === 0) {
      return;
    }

    const exercise: ProgramExercise = {
      activity: title.trim().toLowerCase(),
      sets: sets.map(({ reps, setType }) => ({
        measure: measurement,
        setType,
        reps,
      })),
    };

    onAddExercise(exercise);
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ThemedView
            className="flex-1"
            lightColor={Colors.light.background}
            darkColor={Colors.dark.background}
            style={{ paddingTop: insets.top }}
          >
            <ThemedView className="px-4 pt-2 pb-4">
              <ThemedView className="flex-row items-center justify-between mb-3">
                <Pressable onPress={handleClose} hitSlop={8}>
                  <ThemedText
                    className="text-base"
                    lightColor={Colors.light.mutedText}
                    darkColor={Colors.dark.mutedText}
                  >
                    Cancel
                  </ThemedText>
                </Pressable>
                <ThemedText className="text-base font-semibold">
                  {initialExercise ? "Edit Exercise" : "Add Exercise"}
                </ThemedText>
                <TextPill text={`Day ${dayIndex + 1}`} />
              </ThemedView>
              {titleError ? (
                <>
                  <Text className="text-red-500 mb-2">
                    Please enter an exercise name
                  </Text>
                  <ExerciseNameInput title={title} setTitle={setTitle} />
                </>
              ) : (
                <ExerciseNameInput title={title} setTitle={setTitle} />
              )}
            </ThemedView>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={-50}
            >
              <ScrollView
                className="flex-1 p-4"
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <ThemedView className="w-full mb-8">
                  {sets.map((set, index) => {
                    const displayIndex =
                      sets
                        .slice(0, index + 1)
                        .filter((s) => s.setType === "normal").length - 1;

                    return (
                      <View key={set.id}>
                        <AddSetCard
                          id={set.id}
                          index={displayIndex}
                          reps={set.reps}
                          setType={set.setType}
                          measurement={measurement}
                          repType={isRepsFixed ? "fixed" : "range"}
                          repsOnly
                          onRepsChange={updateReps}
                          onSetTypeChange={updateSetType}
                          onRemove={removeSet}
                          onCopy={copySet}
                        />
                      </View>
                    );
                  })}

                  <View className="flex-row items-start justify-between mt-2">
                    <Button onPress={addSet} className="mb-12">
                      + Enter Set
                    </Button>
                  </View>

                  <View className="items-center justify-between mb-16">
                    <Button type="primary" onPress={handleAdd}>
                      {initialExercise ? "Save Changes" : "Add Exercise"}
                    </Button>
                  </View>
                </ThemedView>
              </ScrollView>
            </KeyboardAvoidingView>
          </ThemedView>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
