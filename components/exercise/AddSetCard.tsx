import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import Animated, { SlideOutRight } from "react-native-reanimated";
import Card from "../Card";
import { ThemedText } from "../ThemedText";

type Props = {
  id: number;
  index: number;
  reps: string;
  value: string;
  onRepsChange: (id: number, newReps: string) => void;
  onValueChange: (id: number, newValue: string) => void;
  onRemove: (id: number) => void;
  onCopy: (id: number) => void;
};

export const AddSetCard: React.FC<Props> = ({
  id,
  index,
  reps,
  value,
  onRepsChange,
  onValueChange,
  onRemove,
  onCopy,
}) => {
  // Width to make Reps picker equal to Kg inputs + dot combined
  const KG_INPUT_TOTAL_WIDTH = 168;
  // Split incoming value into integer and decimal parts
  const [intPart, setIntPart] = useState(value?.split(".")[0] || "");
  const [decPart, setDecPart] = useState(value?.split(".")[1] || "");

  const handleIntChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setIntPart(clean);
    if (clean.length > 0) {
      onValueChange(id, `${clean}${decPart ? "." + decPart : ""}`);
    } else if (decPart.length > 0) {
      onValueChange(id, `0.${decPart}`);
    } else {
      onValueChange(id, "0");
    }
  };

  const handleDecChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setDecPart(clean);
    if (clean.length > 0) {
      const prefix = intPart.length > 0 ? intPart : "0";
      onValueChange(id, `${prefix}.${clean}`);
    } else {
      onValueChange(id, intPart);
    }
  };

  // Keep local parts in sync if parent-provided value changes externally
  useEffect(() => {
    const parts = (value || "").split(".");
    setIntPart(parts[0] || "");
    setDecPart(parts[1] || "");
  }, [value]);
  return (
    <Animated.View exiting={SlideOutRight.duration(200)}>
      <Card>
        <ThemedView className="flex-row items-center justify-between w-full rounded-lg mb-3">
          <ThemedView className="flex-row items-center">
            <Text className="text-sm text-gray-500 mr-5">{index + 1}.</Text>
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
                <ThemedView className="ml-2 justify-center flex-row items-center w-[160px]">
                  <ThemedTextInput
                    value={intPart}
                    onChangeText={handleIntChange}
                    keyboardType="number-pad"
                    maxLength={3}
                    onFocus={() => {
                      setIntPart("");
                    }}
                    onBlur={() => {
                      if (intPart.length === 0 && decPart.length === 0) {
                        onValueChange(id, "0");
                      } else if (intPart.length === 0 && decPart.length > 0) {
                        onValueChange(id, `0.${decPart}`);
                      } else if (intPart.length > 0) {
                        onValueChange(
                          id,
                          `${intPart}${decPart ? `.${decPart}` : ""}`
                        );
                      }
                    }}
                    className="bg-gray-200 dark:bg-gray-900 rounded-lg p-3 text-2xl leading-[24px] w-[72px] text-center"
                  />
                  <ThemedText className="text-2xl mx-2">.</ThemedText>
                  <ThemedTextInput
                    value={decPart}
                    onChangeText={handleDecChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    onFocus={() => {
                      setDecPart("");
                      onValueChange(id, intPart.length > 0 ? intPart : "0");
                    }}
                    className="bg-gray-200 dark:bg-gray-900 rounded-lg p-3 text-2xl leading-[24px] w-[56px] text-center"
                  />
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>
          <ThemedView className="flex-row items-center">
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
  );
};
