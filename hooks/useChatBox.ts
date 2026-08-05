import { runCoachTool } from "@/lib/ai/coachTools";
import { getCoachModel, toContents } from "@/lib/ai/gemini";
import { ChatMessageSchema } from "@/types/types";
import type {
  Content,
  FunctionCall,
  GenerativeModel,
} from "@react-native-firebase/ai";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { useServerErrorHandler } from "./useServerErrorHandler";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Stops a model that keeps asking for tools from hanging the UI forever. */
const MAX_TOOL_ROUNDS = 3;

const FALLBACK_REPLY =
  "Sorry, I couldn't work that one out. Try asking a different way.";

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

/**
 * One user turn: ask the model, run any tools it asks for, ask again with the
 * results, and repeat until it answers with text.
 *
 * We drive `generateContent` and own the `contents` array rather than using
 * `ChatSession`, because ChatSession stamps function responses with
 * `role: "function"` (request-helpers.ts:65) and this backend rejects that role.
 */
const runCoachTurn = async (
  model: GenerativeModel,
  baseContents: Content[],
): Promise<{ reply: string; contents: Content[] }> => {
  let contents = baseContents;
  let result = await model.generateContent({ contents });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Keep the model's own turn — including its functionCall parts — or it
    // loses track of what it just asked for.
    const modelParts = result.response.candidates?.[0]?.content.parts ?? [];
    contents = [...contents, { role: "model", parts: modelParts }];

    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    // Gemini can ask for several tools in one turn, so run them together.
    const responseParts = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: await runToolSafely(call),
        },
      })),
    );

    // role "user", not "function" — this is the whole reason we hand-roll this.
    contents = [...contents, { role: "user", parts: responseParts }];
    result = await model.generateContent({ contents });
  }

  // text() is "" when the model only emitted tool calls — which is what we get
  // if it is still asking for tools after MAX_TOOL_ROUNDS.
  return { reply: result.response.text() || FALLBACK_REPLY, contents };
};

export function useChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // The conversation so far, in the shape the model API wants. null means
  // "not started yet" — we rebuild it from `messages` on the next send.
  const historyRef = useRef<Content[] | null>(null);
  const { handleMutationError } = useServerErrorHandler();

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string): Promise<string> => {
      // First send of a conversation (or the first after Clear chat) rebuilds
      // the list from what is already on screen.
      const history = historyRef.current ?? toContents(messages);

      const { reply, contents } = await runCoachTurn(getCoachModel(), [
        ...history,
        { role: "user", parts: [{ text }] },
      ]);

      // Only commit on success, so a failed turn leaves the history untouched
      // and in step with the messages that onError rolls back.
      historyRef.current = contents;
      return reply;
    },
    onMutate: (text: string) => {
      setMessages((prev) => [...prev, { role: "user", text }]);
    },
    onSuccess: (reply) => {
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    },
    onError: (error) => {
      setMessages((prev) => prev.slice(0, -1));
      historyRef.current = null;
      handleMutationError(error);
    },
  });

  const clearChat = useCallback(() => {
    historyRef.current = null;
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    clearChat,
  };
}
