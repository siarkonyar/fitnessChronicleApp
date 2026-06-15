import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TintedButton } from "@/components/TintedButton";
import { Colors } from "@/constants/Colors";
import { useActiveProgramContext } from "@/context/ActiveProgramContext";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import React, { useState } from "react";
import { ActivityIndicator, Modal, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button } from "./Button";
import ProgramList from "./lists/ProgramList";

export default function ChooseProgram() {
  const theme = useColorScheme() ?? "light";
  const [isOpen, setIsOpen] = useState(false);
  const { activeProgram, selectProgram, isSelecting } =
    useActiveProgramContext();

  function handleSelectProgram(programId: string) {
    selectProgram(programId, {
      onSuccess: () => setIsOpen(false),
    });
  }

  return (
    <>
      <TintedButton onPress={() => setIsOpen(true)}>
        {activeProgram?.name.toUpperCase() ?? "Choose Program"}
      </TintedButton>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <View className="flex-1 items-center justify-center px-4 bg-black backdrop-blur-sm">
              {isSelecting ? (
                <ActivityIndicator
                  size="large"
                  color={Colors[theme].highlight}
                  className="mb-4"
                />
              ) : (
                <ThemedView className="w-11/12 max-w-md mx-4">
                  <ThemedText className="font-bold mb-2 text-center">
                    Choose a Program
                  </ThemedText>
                  <ProgramList programOnPress={handleSelectProgram} />
                  <Button type="danger" onPress={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                </ThemedView>
              )}
            </View>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}
