import { ThemedText } from "@/components/ThemedText";
import { TintedButton } from "@/components/TintedButton";
import { Colors } from "@/constants/Colors";
import { useActiveProgramContext } from "@/context/ActiveProgramContext";
import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useRef } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import ProgramList from "./lists/ProgramList";

export default function ChooseProgram() {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const { activeProgram, selectProgram } = useActiveProgramContext();

  function handleSelectProgram(programId: string) {
    selectProgram(programId, {
      onSuccess: () => bottomSheetModalRef.current?.dismiss(),
    });
  }

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["85%"], []);

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
    <>
      <TintedButton
        fixedWidth
        onPress={() => bottomSheetModalRef.current?.present()}
      >
        {activeProgram?.name.toUpperCase() ?? "Choose Program"}
      </TintedButton>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.background }}
        handleIndicatorStyle={{ backgroundColor: palette.separator }}
      >
        <View className="flex-row items-center justify-between px-5 pb-4">
          <ThemedText type="subtitle">Choose a Day</ThemedText>
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        >
          <ProgramList programOnPress={handleSelectProgram} bare />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
