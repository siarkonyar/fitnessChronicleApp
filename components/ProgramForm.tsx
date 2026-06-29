import { Button } from "@/components/Button";
import AddProgramDayCard from "@/components/cards/AddProgramDayCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import AppTextInput from "@/components/ui/AppTextInput";
import PillButton from "@/components/ui/PillButton";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  LabelSchema,
  ProgramDaySchema,
  ProgramExerciseSchema,
} from "@/types/types";
import { Feather } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from "react-native";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
type Label = z.infer<typeof LabelSchema>;

// Delay before scrolling so the newly added day card has laid out.
const SCROLL_TO_NEW_DAY_DELAY_MS = 100;

interface ProgramFormProps {
  initialName?: string;
  initialDays?: ProgramDay[];
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  onSubmit: (name: string, days: ProgramDay[]) => void;
}

export default function ProgramForm({
  initialName = "",
  initialDays = [],
  submitLabel,
  pendingLabel,
  isSubmitting,
  onSubmit,
}: ProgramFormProps) {
  const scrollRef = useRef<ScrollView>(null);
  const theme = useColorScheme() ?? "light";
  const [programName, setProgramName] = useState(initialName);
  const [nameError, setNameError] = useState(false);
  const [daysError, setDaysError] = useState(false);
  const [days, setDays] = useState<ProgramDay[]>(initialDays);

  function addDay(isRestDay: boolean) {
    setDaysError(false);
    setDays((prev) => [...prev, { isRestDay }]);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, SCROLL_TO_NEW_DAY_DELAY_MS);
  }

  const removeDay = (index: number) => {
    Keyboard.dismiss();
    Alert.alert("Delete Day", "Are you sure you want to delete this day?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setDays((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  function selectLabelForDay(dayIndex: number, label: Label) {
    // Only the name and description belong on a program day. dates,
    // muscleGroups and createdAt are optional, so we just don't carry them.
    const { label: name, description } = label;
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, label: { label: name, description } }
          : day,
      ),
    );
  }

  function addExerciseToDay(dayIndex: number, exercise: ProgramExercise) {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, exercises: [...(day.exercises ?? []), exercise] }
          : day,
      ),
    );
  }

  function updateExerciseInDay(
    dayIndex: number,
    exerciseIndex: number,
    exercise: ProgramExercise,
  ) {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              exercises: (day.exercises ?? []).map((existing, j) =>
                j === exerciseIndex ? exercise : existing,
              ),
            }
          : day,
      ),
    );
  }

  function removeExerciseFromDay(dayIndex: number, exerciseIndex: number) {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              exercises: (day.exercises ?? []).filter(
                (_, j) => j !== exerciseIndex,
              ),
            }
          : day,
      ),
    );
  }

  const handleSubmit = () => {
    if (!programName.trim()) {
      setNameError(true);
      console.warn("Please enter a program name");
      return;
    }

    if (days.length === 0) {
      setDaysError(true);
      console.warn("Please add at least one day to the program");
      return;
    }

    onSubmit(programName.trim(), days);
  };

  return (
    <ThemedView className="flex-1">
      <ThemedView className="px-4 my-4">
        {nameError && (
          <Text className="text-red-500 mb-2">Please enter a program name</Text>
        )}
        <AppTextInput
          value={programName}
          onChangeText={(text) => {
            setProgramName(text);
            if (nameError) setNameError(false);
          }}
          autoFocus={false}
          className="w-full text-3xl font-semibold"
          style={{ textTransform: "uppercase" }}
          placeholder="Program name..."
          autoCapitalize="characters"
        />
      </ThemedView>
      <ThemedView className="flex-row gap-2 px-4 mb-3">
        <ThemedView className="w-1/2 pr-2">
          <PillButton color="highlight" onPress={() => addDay(false)}>
            <Feather name="plus" size={14} color={Colors[theme].highlight} />
            <ThemedText
              className="font-semibold"
              lightColor={Colors.light.highlight}
              darkColor={Colors.dark.highlight}
            >
              Add day
            </ThemedText>
          </PillButton>
        </ThemedView>

        <ThemedView className="w-1/2 pr-2">
          <PillButton color="secondary" onPress={() => addDay(true)}>
            <Feather name="plus" size={14} color={Colors[theme].secondary} />
            <ThemedText
              className="font-semibold"
              lightColor={Colors.light.secondary}
              darkColor={Colors.dark.secondary}
            >
              Add rest day
            </ThemedText>
          </PillButton>
        </ThemedView>
      </ThemedView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={-50}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {days.length === 0 && (
            <ThemedView className="items-center my-12 px-8">
              <Feather
                name="calendar"
                size={32}
                color={Colors[theme].mutedText}
              />
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
                Tap &quot;Add day&quot; or &quot;Add rest day&quot; above to
                start building your program.
              </ThemedText>
              {daysError && (
                <Text className="text-red-500 text-center mt-4">
                  Please add at least one day to your program
                </Text>
              )}
            </ThemedView>
          )}
          {days.map((day, i) => (
            <AddProgramDayCard
              key={i}
              index={i}
              day={day}
              onSelectLabel={(label) => selectLabelForDay(i, label)}
              onAddExercise={(exercise) => addExerciseToDay(i, exercise)}
              onEditExercise={(exerciseIndex, exercise) =>
                updateExerciseInDay(i, exerciseIndex, exercise)
              }
              onDeleteExercise={(exerciseIndex) =>
                removeExerciseFromDay(i, exerciseIndex)
              }
              onDeleteDay={() => removeDay(i)}
              className="mb-3"
            />
          ))}
          <Button
            type="primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="my-6"
          >
            {isSubmitting ? pendingLabel : submitLabel}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
