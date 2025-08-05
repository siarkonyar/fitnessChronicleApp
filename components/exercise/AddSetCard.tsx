import { ThemedView } from "@/components/ThemedView";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Pressable, Text } from "react-native";

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
  return (
    <ThemedView className="flex-row items-center justify-between w-full shadow-md shadow-gray-900 p-3 rounded-lg mb-3">
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
                  width: 150,
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
            <ThemedView className="ml-2 justify-center overflow-hidden">
              <Picker
                selectedValue={value}
                onValueChange={(val) => onValueChange(id, val)}
                mode="dropdown"
                style={{
                  width: 150,
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
                  "0",
                  "5",
                  "10",
                  "15",
                  "20",
                  "25",
                  "30",
                  "35",
                  "40",
                  "45",
                  "50",
                  "55",
                  "60",
                  "65",
                  "70",
                  "75",
                  "80",
                  "85",
                  "90",
                  "95",
                  "100",
                  "105",
                  "110",
                  "115",
                  "120",
                  "125",
                  "130",
                  "135",
                  "140",
                  "145",
                  "150",
                  "155",
                  "160",
                  "165",
                  "170",
                  "175",
                  "180",
                  "185",
                  "190",
                  "195",
                  "200",
                ].map((range) => (
                  <Picker.Item label={range} value={range} key={range} />
                ))}
              </Picker>
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
  );
};
