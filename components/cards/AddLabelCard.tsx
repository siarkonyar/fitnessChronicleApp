import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme, View } from "react-native";
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
  const theme = useColorScheme() ?? "light";

  return (
    <MutedCard
      key={label}
      className={`${className} flex items-center justify-between`}
    >
      <ThemedView className="flex-row items-center flex-1 min-w-0 mr-2">
        <View
          className="w-14 h-14 rounded-2xl mr-4 justify-center items-center"
          style={{
            backgroundColor: `${Colors[theme].highlight}18`,
            borderWidth: 1,
            borderColor: `${Colors[theme].highlight}30`,
          }}
        >
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
              fontSize: 22,
              textAlign: "center",
              textTransform: "uppercase",
              color: Colors[theme].highlight,
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
