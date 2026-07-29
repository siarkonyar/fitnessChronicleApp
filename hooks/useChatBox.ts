import { startChatSession } from "@/lib/ai/gemini";
import { ChatMessageSchema } from "@/types/types";
import type { ChatSession } from "@react-native-firebase/ai";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionRef = useRef<ChatSession | null>(null);
  const { handleMutationError } = useServerErrorHandler();

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string): Promise<string> => {
      if (!sessionRef.current) {
        sessionRef.current = startChatSession(messages);
      }

      const result = await sessionRef.current.sendMessage(text);
      return result.response.text();
    },
    onMutate: (text: string) => {
      setMessages((prev) => [...prev, { role: "user", text }]);
    },
    onSuccess: (reply) => {
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    },
    onError: (error) => {
      setMessages((prev) => prev.slice(0, -1));
      sessionRef.current = null;
      handleMutationError(error);
    },
  });

  const clearChat = useCallback(() => {
    sessionRef.current = null;
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    clearChat,
  };
}
