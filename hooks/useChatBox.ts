import { runCoachTool } from "@/lib/ai/coachTools";
import { startChatSession } from "@/lib/ai/gemini";
import { ChatMessageSchema } from "@/types/types";
import type { ChatSession, FunctionCall } from "@react-native-firebase/ai";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Stops a model that keeps asking for tools from hanging the UI forever. */
const MAX_TOOL_ROUNDS = 3;

/**
 * Runs one tool call, turning any failure into a result the model can read.
 * Throwing here would kill the whole message; this way the model can tell the
 * user it couldn't reach their data and carry on.
 */
const runToolSafely = async (call: FunctionCall): Promise<object> => {
  try {
    return await runCoachTool(call.name, call.args);
  } catch {
    return { error: "Could not read the user's training data right now." };
  }
};

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionRef = useRef<ChatSession | null>(null);
  const { handleMutationError } = useServerErrorHandler();

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string): Promise<string> => {
      if (!sessionRef.current) {
        sessionRef.current = startChatSession(messages);
      }

      const session = sessionRef.current;
      let result = await session.sendMessage(text);

      // The model may answer with tool calls instead of text. Run them, hand
      // the results back, and repeat until it produces a real reply.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const calls = result.response.functionCalls();
        if (!calls || calls.length === 0) break;

        // Gemini can ask for several tools in one turn, so run them together.
        const parts = await Promise.all(
          calls.map(async (call) => ({
            functionResponse: {
              name: call.name,
              response: await runToolSafely(call),
            },
          })),
        );

        result = await session.sendMessage(parts);
      }

      // text() is "" when the model only emitted tool calls — which is what we
      // get if it is still asking for tools after MAX_TOOL_ROUNDS.
      return (
        result.response.text() ||
        "Sorry, I couldn't work that one out. Try asking a different way."
      );
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
