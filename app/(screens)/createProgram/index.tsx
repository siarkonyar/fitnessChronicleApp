import { ThemedView } from "@/components/ThemedView";
import AppTextInput from "@/components/ui/AppTextInput";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function CreateProgramScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [programName, setProgramName] = useState("");

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
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={-50}
          >
            <ScrollView
              ref={scrollRef}
              className="flex-1 p-4"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            />
          </KeyboardAvoidingView>
        </ThemedView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
