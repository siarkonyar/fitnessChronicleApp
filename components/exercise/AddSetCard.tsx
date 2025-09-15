import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, Text, TouchableOpacity } from "react-native";
import Animated, { SlideOutRight } from "react-native-reanimated";
import Card from "../Card";
import { ThemedText } from "../ThemedText";

type Props = {
  id: number;
  index: number;
  reps: string;
  value: string;
  setType: "warmup" | "normal" | "failure" | "drop";
  onRepsChange: (id: number, newReps: string) => void;
  onValueChange: (id: number, newValue: string) => void;
  onSetTypeChange: (
    id: number,
    newSetType: "warmup" | "normal" | "failure" | "drop"
  ) => void;
  onRemove: (id: number) => void;
  onCopy: (id: number) => void;
};

export const AddSetCard: React.FC<Props> = ({
  id,
  index,
  reps,
  value,
  setType,
  onRepsChange,
  onValueChange,
  onSetTypeChange,
  onRemove,
  onCopy,
}) => {
  // Width to make Reps picker equal to Kg inputs + dot combined
  const KG_INPUT_TOTAL_WIDTH = 168;
  const theme = useColorScheme() ?? "light";

  // Bottom sheet ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Variables
  const snapPoints = useMemo(() => [], []);

  const handleValueChange = (text: string) => {
    // Allow only numbers and one decimal point
    const clean = text.replace(/[^0-9.]/g, "");
    // Ensure only one decimal point
    const parts = clean.split(".");
    if (parts.length > 2) {
      return; // More than one decimal point, ignore
    }
    // Limit decimal places to 2
    if (parts.length === 2 && parts[1].length > 2) {
      return; // Too many decimal places, ignore
    }
    // Limit integer part to 3 digits
    if (parts[0].length > 3) {
      return; // Too many digits in integer part, ignore
    }

    onValueChange(id, clean || "0");
  };

  const setTypeDisplay = (type: string) => {
    switch (type) {
      case "normal":
        return <ThemedText>{index + 1}.</ThemedText>;
      case "warmup":
        return (
          <ThemedText
            lightColor={Colors[theme].secondary}
            darkColor={Colors[theme].secondary}
          >
            W
          </ThemedText>
        );
      case "failure":
        return (
          <ThemedText
            lightColor={Colors[theme].danger}
            darkColor={Colors[theme].danger}
          >
            F
          </ThemedText>
        );
      case "drop":
        return (
          <ThemedText
            lightColor={Colors[theme].accentBlue}
            darkColor={Colors[theme].accentBlue}
          >
            D
          </ThemedText>
        );
      default:
        return "th";
    }
  };

  const handleSetTypeSelect = (
    selectedType: "warmup" | "normal" | "failure" | "drop"
  ) => {
    onSetTypeChange(id, selectedType);
    bottomSheetModalRef.current?.dismiss();
  };

  const openDropdown = useCallback(() => {
    try {
      bottomSheetModalRef.current?.present();
      // Force it to open at full height immediately
      requestAnimationFrame(() => {
        try {
          bottomSheetModalRef.current?.snapToIndex(0);
        } catch (error) {
          console.error("Error snapping to index:", error);
        }
      });
    } catch (error) {
      console.error("Error opening dropdown:", error);
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <>
      <Animated.View exiting={SlideOutRight.duration(200)}>
        <Card>
          <ThemedView className="flex-row items-center justify-between w-full rounded-lg">
            <ThemedView className="px-3">
              <TouchableOpacity onPress={openDropdown}>
                {setTypeDisplay(setType)}
              </TouchableOpacity>
            </ThemedView>

            <ThemedView>
              <ThemedView className="flex-row items-center">
                <Text className="text-xl text-gray-500 w-[50px]">Reps:</Text>
                <ThemedView className="ml-2 justify-center overflow-hidden">
                  <Picker
                    selectedValue={reps}
                    onValueChange={(val) => onRepsChange(id, val)}
                    mode="dropdown"
                    style={{
                      width: KG_INPUT_TOTAL_WIDTH,
                      height: 56,
                      color: "#111",
                      backgroundColor: "transparent",
                    }}
                    itemStyle={{
                      fontSize: 20,
                      height: 56,
                    }}
                  >
                    {[
                      "1",
                      "2",
                      "3-4",
                      "5-6",
                      "7-8",
                      "9-10",
                      "10-12",
                      "12-15",
                      "15-20",
                      "20+",
                    ].map((range) => (
                      <Picker.Item label={range} value={range} key={range} />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>
              <ThemedView className="flex-row items-center">
                <Text className="text-xl text-gray-500 w-[50px]">Kg:</Text>
                <ThemedView className="ml-5 justify-center">
                  <ThemedTextInput
                    value={value}
                    onChangeText={handleValueChange}
                    onFocus={() => onValueChange(id, "")}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    className="bg-gray-200 dark:bg-gray-900 rounded-lg p-3 text-2xl leading-[24px] w-[150px] text-center"
                  />
                </ThemedView>
              </ThemedView>
            </ThemedView>
            <ThemedView className="flex-col items-center gap-2">
              <Pressable
                onPress={() => onCopy(id)}
                className="bg-blue-600/70 p-2 rounded-full ml-2 active:opacity-100"
              >
                <Feather name="copy" size={20} color="#F2F2F7" />
              </Pressable>
              <Pressable
                onPress={() => onRemove(id)}
                className="bg-red-500/90 p-2 rounded-full ml-2 active:opacity-100"
              >
                <Ionicons name="close" size={20} color="#F2F2F7" />
              </Pressable>
            </ThemedView>
          </ThemedView>
        </Card>
      </Animated.View>

      {/* Bottom Sheet Modal */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: Colors[theme].cardBackground,
        }}
        handleIndicatorStyle={{
          backgroundColor: Colors[theme].separator,
        }}
      >
        <ThemedText className="text-lg font-semibold text-center mb-6">
          Choose Set Type
        </ThemedText>
        <BottomSheetView style={{ flex: 1 }}>
          <ThemedView
            lightColor={Colors[theme].cardBackground}
            darkColor={Colors[theme].cardBackground}
            className="my-12"
          >
            <TouchableOpacity
              key={"normal"}
              onPress={() => handleSetTypeSelect("normal")}
              className="py-4 px-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 active:bg-gray-100 dark:active:bg-gray-800"
            >
              <ThemedText className="text-xl font-medium text-center">
                Normal
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              key={"warmup"}
              onPress={() => handleSetTypeSelect("warmup")}
              className="py-4 px-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 active:bg-gray-100 dark:active:bg-gray-800"
            >
              <ThemedText
                style={{ color: Colors[theme].secondary }}
                className="text-xl font-medium text-center"
              >
                Warmup
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              key={"failure"}
              onPress={() => handleSetTypeSelect("failure")}
              className="py-4 px-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 active:bg-gray-100 dark:active:bg-gray-800"
            >
              <ThemedText
                style={{ color: Colors[theme].danger }}
                className="text-xl font-medium text-center"
              >
                Failure
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              key={"drop"}
              onPress={() => handleSetTypeSelect("drop")}
              className="py-4 px-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 active:bg-gray-100 dark:active:bg-gray-800"
            >
              <ThemedText
                style={{ color: Colors[theme].accentBlue }}
                className="text-xl font-medium text-center"
              >
                Drop
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};
