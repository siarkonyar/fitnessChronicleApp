import ChatBubble from "@/components/ai/ChatBubble";
import ChatComposer from "@/components/ai/ChatComposer";
import ProgramProposalCard from "@/components/ai/ProgramProposalCard";
import TypingIndicator from "@/components/ai/TypingIndicator";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useChatContext } from "@/context/ChatContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { addLabel, getAllLabels } from "@/lib/firebase/label";
import { addProgram } from "@/lib/firebase/program";
import { reconcileProgramLabels } from "@/lib/programLabels";
import { ProgramSchema } from "@/types/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import { ScrollView, useColorScheme, View } from "react-native";
import { z } from "zod";

type Program = z.infer<typeof ProgramSchema>;

export default function AIScreen() {
  const theme = useColorScheme() ?? "light";
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const { messages, sendMessage, isSending } = useChatContext();

  const queryClient = useQueryClient();
  const { handleMutationError } = useServerErrorHandler();

  const acceptProgramMutation = useMutation({
    mutationFn: async (program: Program) => {
      const existingLabels = await getAllLabels();

      const { days, missingLabels } = reconcileProgramLabels(
        program.days,
        existingLabels,
      );

      await Promise.all(missingLabels.map((label) => addLabel(label)));

      return addProgram(program.name, days);
    },
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.labels.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programs.all }),
      ]);
    },
  });

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;

    sendMessage(text);
    setDraft("");
  };

  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: Colors[theme].background }}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ flexGrow: 1, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={scrollToEnd}
        // The list shrinks when the keyboard opens; re-anchor to the latest message.
        onLayout={scrollToEnd}
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
            <React.Fragment key={index}>
              <ChatBubble message={message} />
              {message.program ? (
                <ProgramProposalCard
                  program={message.program}
                  onAccept={() => {}}
                  onRegenerate={() =>
                    sendMessage("Regenerate that program with some variation.")
                  }
                  isDisabled={isSending}
                />
              ) : null}
            </React.Fragment>
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
  );
}
