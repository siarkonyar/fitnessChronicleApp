import React from "react";
import { View } from "react-native";
import { ThemedTextInput } from "../ThemedTextInput";
import { ThemedView } from "../ThemedView";
import MutedCard from "./MuteCard";

interface AddLabelCardProps {
  label: string;
  description: string;
  setLabel: (label: string) => void;
  setDescription: (description: string) => void;
  className?: string;
}

export default function AddLabelCard({
  label,
  description,
  setLabel,
  setDescription,
  className,
}: AddLabelCardProps) {
  return (
    <MutedCard
      key={label}
      className={`${className} flex items-center justify-between`}
    >
      <ThemedView className="flex-row items-center flex-1 min-w-0 mr-2">
        <View className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm justify-center items-center">
          <ThemedTextInput
            value={label}
            onChangeText={(t) => {
              const chars = Array.from(t);
              const last = chars[chars.length - 1] ?? "";
              setLabel(last.toUpperCase());
            }}
            onKeyPress={({ nativeEvent: { key } }) => {
              if (key === "Backspace") return setLabel("");
              if (
                /[\p{L}\p{N}]/u.test(key) ||
                /\p{Extended_Pictographic}/u.test(key)
              ) {
                setLabel(key.toUpperCase());
              }
            }}
            maxLength={1}
            caretHidden={false}
            autoCapitalize="characters"
            style={{
              fontWeight: "bold",
              fontSize: 18,
              textAlign: "center",
              textTransform: "uppercase",
            }}
            className="text-center"
          />
        </View>
        <ThemedTextInput
          value={description}
          onChangeText={setDescription}
          className="text-base font-medium flex-1 border-b border-gray-400"
        />
      </ThemedView>
    </MutedCard>
  );
}
