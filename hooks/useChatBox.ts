import { queryKeys } from "@/constants/QueryKeys";
import {
  callCoach,
  callUsagePercentage,
  type CoachHistoryMessage,
} from "@/lib/ai/coachServer";
import { getTodayString } from "@/lib/dateUtils";
import { getDefaultMeasurement, getDefaultRepType } from "@/lib/offlineStorage";
import { ChatMessageSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const QUOTA_ERROR_CODE = "functions/resource-exhausted";

const QUOTA_MESSAGE = "You've used your AI coach allowance for this month.";

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  // The query cache is the only holder of this figure. A parallel useState
  // would drift: the cache is what gets persisted to AsyncStorage, so a value
  // kept only in state is lost on close and the stale cached one comes back.
  //
  // staleTime 0 overrides the global 5-minute default — the allowance can move
  // on another device, and a rehydrated figure should never outlive one open.
  const { data: percentUsed = null, error: usageError } = useQuery({
    queryKey: queryKeys.aiUsage.all,
    queryFn: callUsagePercentage,
    staleTime: 0,
  });

  useEffect(() => {
    if (usageError) handleQueryError(usageError);
  }, [usageError, handleQueryError]);

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
    onSuccess: ({ reply, program, percentUsed: nextPercentUsed }) => {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: reply, ...(program && { program }) },
      ]);
      // Written into the cache, not into local state, so the persisted copy
      // matches what's on screen — otherwise the next open rehydrates the old
      // figure and the bar reads stale until another message is sent.
      queryClient.setQueryData(queryKeys.aiUsage.all, nextPercentUsed);
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
    percentUsed,
  };
}
