import ChatBubble from "@/components/ai/ChatBubble";
import ChatComposer from "@/components/ai/ChatComposer";
import TypingIndicator from "@/components/ai/TypingIndicator";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useChatBox } from "@/hooks/useChatBox";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";

const KEYBOARD_VERTICAL_OFFSET = 0;

export default function AIScreen() {
  const theme = useColorScheme() ?? "light";
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const { messages, sendMessage, isSending } = useChatBox();

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;

    sendMessage(text);
    setDraft("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: Colors[theme].background }}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 16 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ThemedText type="label">YOUR AI COACH</ThemedText>
              <ThemedText type="subtitle" className="text-center">
                Ask me anything about training
              </ThemedText>
              <ThemedText className="mt-2 text-center opacity-60">
                Form, programming, nutrition. Start typing below.
              </ThemedText>
            </View>
          ) : (
            messages.map((message, index) => (
              <ChatBubble key={index} message={message} />
            ))
          )}

          {isSending ? <TypingIndicator /> : null}
        </ScrollView>

        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          disabled={isSending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
