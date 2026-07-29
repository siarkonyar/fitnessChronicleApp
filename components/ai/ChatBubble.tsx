import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { ChatMessageSchema } from "@/types/types";
import React from "react";
import { useColorScheme, View } from "react-native";
import { z } from "zod";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

type ChatBubbleProps = {
  message: ChatMessage;
};

export default function ChatBubble({ message }: ChatBubbleProps) {
  const theme = useColorScheme() ?? "light";
  const isUser = message.role === "user";

  return (
    <View
      className={`mb-3 max-w-[85%] rounded-3xl px-4 py-2 ${
        isUser ? "self-end" : "self-start"
      }`}
      style={{
        backgroundColor: isUser
          ? Colors[theme].highlight
          : Colors[theme].cardBackground,
        borderWidth: isUser ? 0 : 1,
        borderColor: Colors[theme].cardBorderColor,
      }}
    >
      {/* User bubbles sit on `highlight`, the same orange in both themes,
          so their text stays white regardless of color scheme. */}
      <ThemedText
        className="text-base"
        lightColor={isUser ? Colors.light.cardBackground : Colors.light.text}
        darkColor={isUser ? Colors.light.cardBackground : Colors.dark.text}
      >
        {message.text}
      </ThemedText>
    </View>
  );
}
