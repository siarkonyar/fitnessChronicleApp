import { callCoach, type CoachHistoryMessage } from "@/lib/ai/coachServer";
import { getDefaultMeasurement, getDefaultRepType } from "@/lib/offlineStorage";
import { ChatMessageSchema } from "@/types/types";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { Alert } from "react-native";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const QUOTA_ERROR_CODE = "functions/resource-exhausted";

const QUOTA_MESSAGE = "You've used your AI coach allowance for this month.";

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { handleMutationError } = useServerErrorHandler();

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const [isRepsFixed, measure] = await Promise.all([
        getDefaultRepType(),
        getDefaultMeasurement(),
      ]);

      const history: CoachHistoryMessage[] = messages.map(({ role, text }) => ({
        role,
        text,
      }));

      return callCoach({
        message: text,
        history,
        today: getTodayString(),
        prefs: { repType: isRepsFixed ? "fixed" : "range", measure },
      });
    },
    onMutate: (text: string) => {
      setMessages((prev) => [...prev, { role: "user", text }]);
    },
    onSuccess: ({ reply, program }) => {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: reply, ...(program && { program }) },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => prev.slice(0, -1));

      if ((error as { code?: string }).code === QUOTA_ERROR_CODE) {
        Alert.alert("AI coach", QUOTA_MESSAGE);
        return;
      }

      handleMutationError(error);
    },
  });

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    clearChat,
  };
}
