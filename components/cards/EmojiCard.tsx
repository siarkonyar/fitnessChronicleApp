import React from "react";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { EmojiWithIdSchema } from "../../types/types";
import { ThemedText } from "../ThemedText";

interface EmojiCardProps {
  index: number;
  emoji: z.infer<typeof EmojiWithIdSchema>;
  onPress?: (emojiId: string) => void;
}

export default function EmojiCard({ index, emoji, onPress }: EmojiCardProps) {
  return (
    <>
      <Pressable
        key={emoji.id ?? `${emoji.emoji}-${index}`}
        onPress={() => emoji.id && onPress?.(emoji.id)}
        className="flex-row items-center p-4 border border-gray-200/50 dark:border-gray-600/50 rounded-xl active:scale-95 transition-transform shadow-sm"
      >
        <View className="bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm">
          <Text className="text-2xl leading-7">{emoji.emoji}</Text>
        </View>
        <ThemedText className="flex-1 text-base font-medium">
          {emoji.description}
        </ThemedText>
      </Pressable>
    </>
  );
}
