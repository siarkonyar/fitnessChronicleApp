import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Pressable, Text } from "react-native";
import Animated, { SlideOutRight } from "react-native-reanimated";
import Card from "../Card";

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
  return (
    <Animated.View exiting={SlideOutRight.duration(200)}>
      <Card>
        <ThemedView className="flex-row items-center justify-between w-full rounded-lg">
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
  );
};
