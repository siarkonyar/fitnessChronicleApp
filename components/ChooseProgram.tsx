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
  Pressable,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import ProgramList from "./lists/ProgramList";
import { RoundedButton } from "./RoundButton";

export default function ChooseProgram() {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.85;
  const { activeProgram, selectProgram, removeProgramSelection } =
    useActiveProgramContext();

  function handleSelectProgram(programId: string) {
    selectProgram(programId, {
      onSuccess: () => bottomSheetModalRef.current?.dismiss(),
    });
  }

  function handleRemoveProgramSelection() {
    removeProgramSelection(undefined, {
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
        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
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
            <RoundedButton
              type="danger"
              icon="x"
              onPress={() => bottomSheetModalRef.current?.dismiss()}
            />
          </View>

          {activeProgram ? (
            <View
              className="mx-5 mb-4 flex-row items-center justify-between rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: `${palette.highlight}18`,
                borderColor: `${palette.highlight}30`,
              }}
            >
              <View className="mr-3 flex-1">
                <ThemedText
                  className="text-xs font-semibold uppercase"
                  style={{ color: palette.highlight }}
                  numberOfLines={1}
                >
                  Currently following
                </ThemedText>
                <ThemedText
                  className="text-base font-bold uppercase"
                  numberOfLines={1}
                >
                  {activeProgram.name}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleRemoveProgramSelection}
                className="flex-row items-center rounded-full px-3 py-2 active:opacity-70"
                style={{ backgroundColor: `${palette.danger}1A` }}
              >
                <Feather name="x" size={14} color={palette.danger} />
                <ThemedText
                  className="ml-1 text-sm font-semibold"
                  style={{ color: palette.danger }}
                >
                  Unselect
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View className="px-5 pb-5">
            <ProgramList programOnPress={handleSelectProgram} bare />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
