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
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

type ChatError = {
  message: string;
  /** Quota is terminal for the period; a rate limit clears on its own. */
  isQuota: boolean;
};

const QUOTA_ERROR_CODE = "functions/resource-exhausted";

const QUOTA_MESSAGE = "You've used your AI coach allowance for this month.";
const RATE_LIMIT_MESSAGE =
  "You're sending messages too quickly. Give it a moment.";
const GENERIC_ERROR_MESSAGE = "Couldn't reach your coach. Please try again.";

/** The usage bar reaches this at exactly the point the server starts refusing. */
const QUOTA_EXHAUSTED_PERCENT = 100;

/**
 * Firebase has no distinct too-many-requests code, so the server sends both
 * refusals as resource-exhausted and separates them with details.reason.
 */
const readRejectionReason = (error: unknown): "quota" | "rate_limit" | null => {
  const { code, details } = error as {
    code?: string;
    details?: { reason?: string };
  };

  if (code !== QUOTA_ERROR_CODE) return null;

  return details?.reason === "rate_limit" ? "rate_limit" : "quota";
};

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendError, setSendError] = useState<ChatError | null>(null);
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
      setSendError(null);
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

      const reason = readRejectionReason(error);

      if (reason) {
        setSendError({
          message: reason === "rate_limit" ? RATE_LIMIT_MESSAGE : QUOTA_MESSAGE,
          isQuota: reason === "quota",
        });
        return;
      }

      // Offline gets its own alert with a "Go to Offline Page" action — the banner
      // would be a weaker duplicate. Only speak up when nothing else did.
      const wasHandled = handleMutationError(error);
      if (!wasHandled) {
        setSendError({ message: GENERIC_ERROR_MESSAGE, isQuota: false });
      }
    },
  });

  const clearChat = useCallback(() => {
    setMessages([]);
    setSendError(null);
  }, []);

  // Derived, not stored: a boolean kept in state would need to be re-synced every
  // time percentUsed moves, and would drift the moment one update was missed.
  const isQuotaExhausted =
    sendError?.isQuota === true ||
    (percentUsed !== null && percentUsed >= QUOTA_EXHAUSTED_PERCENT);

  // A dead input with no explanation reads as a broken app. Someone who opens
  // the chat already at 100% has never sent the message that would have
  // produced an error, so the quota message has to stand on its own — and it
  // outranks a leftover rate-limit notice, which is not why they're locked out.
  const bannerMessage = isQuotaExhausted
    ? QUOTA_MESSAGE
    : (sendError?.message ?? null);

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    clearChat,
    percentUsed,
    sendError: bannerMessage,
    isQuotaExhausted,
  };
}
