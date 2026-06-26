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
import {
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import ProgramList from "./lists/ProgramList";

export default function ChooseProgram() {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.85;
  const { activeProgram, selectProgram } = useActiveProgramContext();

  function handleSelectProgram(programId: string) {
    selectProgram(programId, {
      onSuccess: () => bottomSheetModalRef.current?.dismiss(),
    });
  }

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);

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
        maxDynamicContentSize={maxDynamicContentSize}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.background }}
        handleIndicatorStyle={{ backgroundColor: palette.separator }}
      >
        <View className="flex-row items-center px-5 pb-4">
          <View className="flex-1 mr-3">
            <ThemedText className="text-xl font-bold" numberOfLines={1}>
              Choose Program
            </ThemedText>
            <ThemedText
              className="text-sm"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
              numberOfLines={1}
            >
              Pick the plan you want to follow
            </ThemedText>
          </View>
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
