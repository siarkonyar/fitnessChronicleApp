import AddProgramDayCard from "@/components/cards/AddProgramDayCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import AppTextInput from "@/components/ui/AppTextInput";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LabelSchema, ProgramDaySchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;
type Label = z.infer<typeof LabelSchema>;

export default function CreateProgramScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const theme = useColorScheme() ?? "light";
  const [programName, setProgramName] = useState("");
  const [days, setDays] = useState<ProgramDay[]>([]);

  function addDay(isRestDay: boolean) {
    setDays((prev) => [...prev, { index: prev.length, isRestDay }]);
  }

  const removeDay = (index: number) => {
    Keyboard.dismiss();
    setDays((prev) => prev.filter((d) => d.index !== index));
  };

  function selectLabelForDay(dayIndex: number, label: Label) {
    setDays((prev) =>
      prev.map((day, i) => (i === dayIndex ? { ...day, label } : day)),
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemedView className="flex-1">
          <ThemedView className="px-4 my-4">
            <AppTextInput
              value={programName}
              onChangeText={setProgramName}
              autoFocus={false}
              className="w-full text-3xl font-semibold"
              style={{ textTransform: "uppercase" }}
              placeholder="Program name..."
              autoCapitalize="characters"
            />
          </ThemedView>
          <ThemedView className="flex-row justify-between">
            <TouchableOpacity
              className="px-4 mb-3 flex-row items-center gap-1 active:opacity-70"
              onPress={() => addDay(true)}
            >
              <Feather name="plus" size={16} color={Colors[theme].secondary} />
              <ThemedText
                className="text-sm font-medium"
                lightColor={Colors.light.secondary}
                darkColor={Colors.dark.secondary}
              >
                Add rest day
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              className="px-4 mb-3 flex-row items-center gap-1 active:opacity-70"
              onPress={() => addDay(false)}
            >
              <Feather name="plus" size={16} color={Colors[theme].highlight} />
              <ThemedText
                className="text-sm font-medium"
                lightColor={Colors.light.highlight}
                darkColor={Colors.dark.highlight}
              >
                Add day
              </ThemedText>
            </TouchableOpacity>
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
              {days.map((day, i) => (
                <AddProgramDayCard
                  key={i}
                  index={i}
                  day={day}
                  onSelectLabel={(label) => selectLabelForDay(i, label)}
                  onDeleteDay={(i) => removeDay(i)}
                  className="mb-3"
                />
              ))}
            </ScrollView>
          </KeyboardAvoidingView>
        </ThemedView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
