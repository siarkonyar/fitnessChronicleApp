import { Button } from "@/components/Button";
import ExerciseNameInput from "@/components/exercise/ExerciseNameInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { getDefaultMeasurement, getDefaultRepType } from "@/lib/offlineStorage";
import { ProgramExerciseSchema } from "@/types/types";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";
import { AddSetCard } from "../exercise/AddSetCard";

type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;

type SetType = "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr";

interface AddProgramExerciseModalProps {
  visible: boolean;
  dayIndex: number;
  onClose: () => void;
  onAddExercise: (exercise: ProgramExercise) => void;
}

export default function AddProgramExerciseModal({
  visible,
  dayIndex,
  onClose,
  onAddExercise,
}: AddProgramExerciseModalProps) {
  // TODO 1: state — title, titleError, sets ({ id, reps, setType }), isRepsFixed, measurement

  // TODO 2: useEffect — load getDefaultRepType() and getDefaultMeasurement()

  // TODO 3: set handlers — addSet, removeSet, updateReps, updateSetType, copySet

  // TODO 4: handleAdd — validate, build ProgramExercise, call onAddExercise, reset, close

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* TODO 5: GestureHandlerRootView > BottomSheetModalProvider wrapper
          (needed so AddSetCard's set-type bottom sheet renders INSIDE this modal) */}
      {/* TODO 6: header (ExerciseNameInput + day number), set list with AddSetCard
          (repsOnly), "+ Enter Set", Add / Cancel buttons */}
    </Modal>
  );
}
